import { create } from "zustand";

import type {
  BlockDelta,
  CursorPosition,
  EditorConnectionStatus,
  EditorContentUpdate,
  EditorSyncState,
  TiptapDocument,
} from "../types/editor";

interface EditorState {
  activeNoteId: string | null;
  content: TiptapDocument;
  version: number;
  isSynced: boolean;
  connectionStatus: EditorConnectionStatus;
  localCursor: CursorPosition | null;
  lastLocalEditAt: number | null;
  lastRemoteSyncAt: number | null;
  lastConnectionChangeAt: number | null;
  lastError: string | null;

  setActiveNote: (noteId: string | null) => void;
  setConnectionStatus: (status: EditorConnectionStatus) => void;
  setLocalContent: (content: TiptapDocument) => void;
  setLocalCursor: (cursor: CursorPosition | null) => void;
  markContentSent: () => void;
  initializeFromSync: (data: EditorSyncState, noteId?: string) => void;
  applyRemoteDelta: (data: EditorContentUpdate) => void;
  setError: (message: string | null) => void;
  clearTransientState: () => void;
  reset: () => void;
}

/**
 * Normalize the current document into the minimal structure the collaboration
 * flow expects. This keeps downstream delta application logic simple even when
 * the editor starts from `null` or an unexpected payload.
 */
function ensureDocument(content: TiptapDocument): Record<string, unknown> {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const doc = { ...content } as Record<string, unknown>;
    const blocks = doc.content;
    if (Array.isArray(blocks)) {
      return doc;
    }

    return {
      ...doc,
      type: typeof doc.type === "string" ? doc.type : "doc",
      content: [],
    };
  }

  return {
    type: "doc",
    content: [],
  };
}

/**
 * Extract the stable top-level block id used by the websocket collaboration
 * protocol. Both `block_id` and `id` are supported so the store can reconcile
 * older data shapes and normalized editor payloads.
 */
function getBlockId(node: unknown): string | null {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return null;
  }

  const record = node as Record<string, unknown>;

  const attrs = record.attrs;
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
    const attrsRecord = attrs as Record<string, unknown>;

    const blockId = attrsRecord.block_id;
    if (typeof blockId === "string" && blockId.length > 0) {
      return blockId;
    }

    const id = attrsRecord.id;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }

  const directBlockId = record.block_id;
  if (typeof directBlockId === "string" && directBlockId.length > 0) {
    return directBlockId;
  }

  const directId = record.id;
  if (typeof directId === "string" && directId.length > 0) {
    return directId;
  }

  return null;
}

/**
 * Ensure an incoming block still carries the collaboration attributes after
 * local or remote transformations. The backend merges by block id, so dropping
 * these attrs would make later updates ambiguous.
 */
function withBlockId(
  content: Record<string, unknown>,
  blockId: string,
): Record<string, unknown> {
  const attrs =
    content.attrs &&
    typeof content.attrs === "object" &&
    !Array.isArray(content.attrs)
      ? { ...(content.attrs as Record<string, unknown>) }
      : {};

  if (typeof attrs.block_id !== "string") {
    attrs.block_id = blockId;
  }

  if (typeof attrs.id !== "string") {
    attrs.id = blockId;
  }

  return {
    ...content,
    attrs,
  };
}

function clampIndex(index: number, length: number): number {
  if (index < 0) return 0;
  if (index > length) return length;
  return index;
}

/**
 * Apply a single backend delta to the current top-level block list. Moved
 * blocks are represented as delete + insert by the collaboration helper, so
 * this reducer only needs to handle primitive insert/update/delete actions.
 */
function applyBlockDelta(blocks: unknown[], delta: BlockDelta): unknown[] {
  const next = [...blocks];
  const existingIndex = next.findIndex(
    (node) => getBlockId(node) === delta.block_id,
  );

  if (delta.action === "delete") {
    if (existingIndex >= 0) {
      next.splice(existingIndex, 1);
    }
    return next;
  }

  if (
    !delta.content ||
    typeof delta.content !== "object" ||
    Array.isArray(delta.content)
  ) {
    return next;
  }

  const blockContent = withBlockId(
    delta.content as Record<string, unknown>,
    delta.block_id,
  );

  if (delta.action === "insert") {
    if (existingIndex >= 0) {
      next.splice(existingIndex, 1);
    }

    const index = clampIndex(delta.position ?? next.length, next.length);
    next.splice(index, 0, blockContent);
    return next;
  }

  if (delta.action === "update") {
    if (existingIndex >= 0) {
      next.splice(existingIndex, 1, blockContent);
      return next;
    }

    const index = clampIndex(delta.position ?? next.length, next.length);
    next.splice(index, 0, blockContent);
  }

  return next;
}

/**
 * Reduce remote websocket deltas into the current document snapshot. The store
 * keeps this logic local so both the websocket hook and the editor component
 * can treat remote updates as atomic state transitions.
 */
function applyRemoteDeltasToDocument(
  content: TiptapDocument,
  deltas: BlockDelta[],
): TiptapDocument {
  const doc = ensureDocument(content);
  const currentBlocks = Array.isArray(doc.content) ? doc.content : [];
  const nextBlocks = deltas.reduce<unknown[]>(
    (blocks, delta) => applyBlockDelta(blocks, delta),
    currentBlocks,
  );

  return {
    ...doc,
    content: nextBlocks as TiptapDocument extends Record<string, infer TValue>
      ? TValue
      : never,
  };
}

const initialState = {
  activeNoteId: null as string | null,
  content: null as TiptapDocument,
  version: 0,
  isSynced: true,
  connectionStatus: "idle" as EditorConnectionStatus,
  localCursor: null as CursorPosition | null,
  lastLocalEditAt: null as number | null,
  lastRemoteSyncAt: null as number | null,
  lastConnectionChangeAt: null as number | null,
  lastError: null as string | null,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,

  /**
   * Switching notes should preserve the current note state only when the same
   * note remains active. Otherwise we intentionally clear collaboration state so
   * a newly opened note does not momentarily render stale content or cursors.
   */
  setActiveNote: (noteId) =>
    set((state) => {
      const isSameNote = noteId === state.activeNoteId;

      return {
        activeNoteId: noteId,
        content: isSameNote ? state.content : null,
        version: isSameNote ? state.version : 0,
        isSynced: isSameNote ? state.isSynced : true,
        localCursor: isSameNote ? state.localCursor : null,
        lastLocalEditAt: isSameNote ? state.lastLocalEditAt : null,
        lastRemoteSyncAt: isSameNote ? state.lastRemoteSyncAt : null,
        lastError: isSameNote ? state.lastError : null,
      };
    }),

  /**
   * Connection status changes are tracked separately from content sync so the
   * UI can explain whether a pending state is due to unsent local edits or a
   * transport problem.
   */
  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
      lastConnectionChangeAt: Date.now(),
    }),

  /**
   * Local edits immediately update the editor snapshot and mark it as dirty.
   * The websocket sender is responsible for flipping the document back to
   * synced once the corresponding delta batch is accepted for transmission.
   */
  setLocalContent: (content) =>
    set({
      content,
      isSynced: false,
      lastLocalEditAt: Date.now(),
      lastError: null,
    }),

  /**
   * Track the local cursor in store state so selection-aware UI and websocket
   * publishing logic can read a consistent source of truth.
   */
  setLocalCursor: (cursor) =>
    set({
      localCursor: cursor,
    }),

  /**
   * Called when the current local document snapshot has been successfully handed
   * off to the websocket transport. This does not guarantee server persistence,
   * but it does mean the local editor is no longer waiting on a send attempt.
   */
  markContentSent: () =>
    set((state) => ({
      isSynced: state.connectionStatus !== "open" ? state.isSynced : true,
      lastError: null,
    })),

  /**
   * Sync-state messages replace the local editor snapshot wholesale. This is
   * the authoritative reset path used on first connect and after reconnects.
   */
  initializeFromSync: (data, noteId) =>
    set({
      activeNoteId: noteId ?? null,
      content: data.content,
      version: data.version,
      isSynced: true,
      connectionStatus: "open",
      lastRemoteSyncAt: Date.now(),
      lastError: null,
    }),

  /**
   * Remote deltas are applied on top of the current local document. We treat
   * them as authoritative and mark the document synced because the store now
   * reflects the latest collaboration state observed from the backend.
   */
  applyRemoteDelta: (data) =>
    set((state) => ({
      content: applyRemoteDeltasToDocument(state.content, data.blocks),
      version: data.version,
      isSynced: true,
      lastRemoteSyncAt: Date.now(),
      lastError: null,
    })),

  setError: (message) =>
    set({
      lastError: message,
    }),

  /**
   * Clear ephemeral collaboration metadata while preserving the current note
   * snapshot. This is useful when the transport resets but we do not want to
   * wipe the editor body the user is looking at.
   */
  clearTransientState: () =>
    set({
      isSynced: true,
      localCursor: null,
      lastError: null,
    }),

  reset: () =>
    set({
      ...initialState,
    }),
}));

export type { EditorState };
