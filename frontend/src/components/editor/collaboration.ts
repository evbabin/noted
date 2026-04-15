import { Extension } from "@tiptap/react";

import type {
  BlockDelta,
  JSONObject,
  TiptapDocument,
  TiptapNode,
} from "../../types/editor";

/**
 * Top-level document nodes are treated as collaboration "blocks" by the
 * backend. Each block needs a stable id so the frontend can send insert /
 * update / delete deltas instead of re-sending the entire note body.
 */
const COLLABORATION_BLOCK_NODE_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
] as const;

/**
 * Browser-safe block id generation for notes that predate collaboration
 * metadata. We prefer `crypto.randomUUID()` when available so ids are stable
 * enough across long editing sessions.
 */
function createBlockId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `block_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * TipTap documents are plain JSON, so a JSON round-trip is a simple and safe
 * way to deep-clone without mutating the caller's object graph.
 */
function cloneNode<T>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

function isNode(value: unknown): value is TiptapNode {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDocument(value: unknown): value is Exclude<TiptapDocument, null> {
  return isNode(value);
}

/**
 * Extract the collaboration block id from a node. We support both
 * `attrs.block_id` and `attrs.id` because older payloads and different UI
 * layers may use either representation.
 */
export function getBlockId(node: unknown): string | null {
  if (!isNode(node)) {
    return null;
  }

  const attrs = node.attrs;
  if (!isNode(attrs)) {
    return null;
  }

  if (typeof attrs.block_id === "string" && attrs.block_id.length > 0) {
    return attrs.block_id;
  }

  if (typeof attrs.id === "string" && attrs.id.length > 0) {
    return attrs.id;
  }

  return null;
}

/**
 * Ensure a node has both `attrs.block_id` and `attrs.id`. Keeping both in sync
 * makes the data shape easier to consume across the editor, websocket payloads,
 * and backend persistence logic.
 */
export function withBlockIdentity(
  node: TiptapNode,
  preferredId?: string,
): TiptapNode {
  const nextNode = cloneNode(node);
  const currentId = getBlockId(nextNode);
  const blockId = preferredId ?? currentId ?? createBlockId();

  const attrs: JSONObject = isNode(nextNode.attrs)
    ? cloneNode(nextNode.attrs as JSONObject)
    : {};

  attrs.block_id = blockId;
  attrs.id = blockId;
  nextNode.attrs = attrs;

  return nextNode;
}

/**
 * Normalize a TipTap document so every top-level block carries a stable,
 * unique collaboration id. The backend's last-write-wins block merge depends
 * on these ids being present and collision-free.
 */
export function normalizeDocument(content: TiptapDocument): TiptapDocument {
  if (!isDocument(content)) {
    return {
      type: "doc",
      content: [],
    };
  }

  const nextDocument = cloneNode(content);
  const rawBlocks = Array.isArray(nextDocument.content)
    ? nextDocument.content
    : [];
  const seenIds = new Set<string>();

  nextDocument.type =
    typeof nextDocument.type === "string" ? nextDocument.type : "doc";

  const normalizedBlocks: TiptapNode[] = rawBlocks.map((block) => {
    if (!isNode(block)) {
      return {
        type: "paragraph",
        attrs: {
          block_id: createBlockId(),
          id: createBlockId(),
        },
      };
    }

    const existingId = getBlockId(block);
    const uniqueId =
      existingId && !seenIds.has(existingId) ? existingId : undefined;

    const normalized = withBlockIdentity(block, uniqueId);
    const normalizedId = getBlockId(normalized);

    if (normalizedId) {
      seenIds.add(normalizedId);
    }

    return normalized;
  });

  nextDocument.content = normalizedBlocks;
  return nextDocument;
}

/**
 * Centralized serialization helper so equality checks stay consistent anywhere
 * we compare collaboration documents or blocks.
 */
export function serializeDocument(content: unknown): string {
  return JSON.stringify(content ?? null);
}

/**
 * Compare the previous and next top-level TipTap blocks and build the websocket
 * deltas expected by the backend. Reordered blocks are represented as a delete
 * plus insert pair, which matches the backend's simple last-write-wins merge.
 */
export function buildBlockDeltas(
  previousDocument: TiptapDocument,
  nextDocument: TiptapDocument,
): BlockDelta[] {
  const previous = normalizeDocument(previousDocument);
  const next = normalizeDocument(nextDocument);

  const previousBlocks = Array.isArray(previous?.content)
    ? previous.content.filter(isNode)
    : [];
  const nextBlocks = Array.isArray(next?.content)
    ? next.content.filter(isNode)
    : [];

  const previousIndexById = new Map<string, number>();
  const previousBlockById = new Map<string, TiptapNode>();
  const nextIndexById = new Map<string, number>();
  const nextBlockById = new Map<string, TiptapNode>();

  previousBlocks.forEach((block, index) => {
    const blockId = getBlockId(block);
    if (!blockId) {
      return;
    }

    previousIndexById.set(blockId, index);
    previousBlockById.set(blockId, block);
  });

  nextBlocks.forEach((block, index) => {
    const blockId = getBlockId(block);
    if (!blockId) {
      return;
    }

    nextIndexById.set(blockId, index);
    nextBlockById.set(blockId, block);
  });

  const deleteDeltas: BlockDelta[] = [];

  for (const [blockId, previousIndex] of previousIndexById.entries()) {
    const nextIndex = nextIndexById.get(blockId);

    if (nextIndex === undefined || nextIndex !== previousIndex) {
      deleteDeltas.push({
        block_id: blockId,
        action: "delete",
        position: previousIndex,
      });
    }
  }

  deleteDeltas.sort(
    (left, right) => (right.position ?? 0) - (left.position ?? 0),
  );

  const insertOrUpdateDeltas: BlockDelta[] = [];

  for (const [blockId, nextIndex] of nextIndexById.entries()) {
    const previousIndex = previousIndexById.get(blockId);
    const nextBlock = nextBlockById.get(blockId);

    if (!nextBlock) {
      continue;
    }

    if (previousIndex === undefined || previousIndex !== nextIndex) {
      insertOrUpdateDeltas.push({
        block_id: blockId,
        action: "insert",
        content: nextBlock,
        position: nextIndex,
      });
      continue;
    }

    const previousBlock = previousBlockById.get(blockId);
    if (!previousBlock) {
      insertOrUpdateDeltas.push({
        block_id: blockId,
        action: "insert",
        content: nextBlock,
        position: nextIndex,
      });
      continue;
    }

    if (serializeDocument(previousBlock) !== serializeDocument(nextBlock)) {
      insertOrUpdateDeltas.push({
        block_id: blockId,
        action: "update",
        content: nextBlock,
        position: nextIndex,
      });
    }
  }

  return [...deleteDeltas, ...insertOrUpdateDeltas];
}

/**
 * TipTap / ProseMirror only preserve attributes that exist in the schema.
 * Without this extension, any `block_id` / `id` metadata attached to blocks
 * would be dropped during editor transforms, which would break the backend's
 * block-delta collaboration protocol.
 *
 * We intentionally do not use TipTap's Yjs-based collaboration extensions
 * here. The current backend speaks a custom websocket JSON protocol, not Yjs
 * updates / awareness messages, so the safest integration is to preserve
 * stable block ids inside the normal TipTap document model.
 */
export const CollaborationBlockIdentityExtension = Extension.create({
  name: "collaborationBlockIdentity",

  addGlobalAttributes() {
    return COLLABORATION_BLOCK_NODE_TYPES.map((type) => ({
      types: [type],
      attributes: {
        block_id: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute("data-block-id"),
          renderHTML: (attributes: Record<string, unknown>) => {
            if (
              typeof attributes.block_id !== "string" ||
              attributes.block_id.length === 0
            ) {
              return {};
            }

            return {
              "data-block-id": attributes.block_id,
            };
          },
        },
        id: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute("data-block-id"),
          renderHTML: (attributes: Record<string, unknown>) => {
            if (
              typeof attributes.id !== "string" ||
              attributes.id.length === 0
            ) {
              return {};
            }

            return {
              "data-block-id": attributes.id,
            };
          },
        },
      },
    }));
  },
});
