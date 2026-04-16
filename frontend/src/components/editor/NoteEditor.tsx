import { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { useWebSocket } from "../../hooks/useWebSocket";
import { useEditorStore } from "../../stores/editorStore";
import type {
  BlockDelta,
  CursorPosition,
  TiptapDocument,
} from "../../types/editor";
import type { ClientMessage } from "../../types/websocket";
import { CursorOverlay } from "./CursorOverlay";
import {
  CollaborationBlockIdentityExtension,
  buildBlockDeltas,
  normalizeDocument,
  serializeDocument,
} from "./collaboration";
import { PresenceBar } from "./PresenceBar";
import { LoadingState } from "../ui/LoadingState";

interface NoteEditorProps {
  noteId: string;
  initialContent: unknown;
  editable?: boolean;
  placeholder?: string;
}

const LOCAL_UPDATE_DEBOUNCE_MS = 300;
const CURSOR_UPDATE_DEBOUNCE_MS = 80;

function asDocument(value: unknown): TiptapDocument {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as TiptapDocument;
  }

  return null;
}

function buildCursorPayload(editor: Editor): CursorPosition {
  const { from, to } = editor.state.selection;

  if (from === to) {
    return {
      position: from,
    };
  }

  return {
    position: to,
    selection: {
      from,
      to,
    },
  };
}

export function NoteEditor({
  noteId,
  initialContent,
  editable = true,
}: NoteEditorProps) {
  const editorContent = useEditorStore((state) => state.content);
  const editorStatus = useEditorStore((state) => state.connectionStatus);
  const setLocalContent = useEditorStore((state) => state.setLocalContent);
  const setLocalCursor = useEditorStore((state) => state.setLocalCursor);
  const markContentSent = useEditorStore((state) => state.markContentSent);

  const {
    send,
    connectionStatus: websocketStatus,
    lastError,
  } = useWebSocket(noteId);

  const applyingExternalContentRef = useRef(false);
  const lastSentDocumentRef = useRef<TiptapDocument>(
    normalizeDocument(asDocument(initialContent)),
  );
  const queuedDocumentRef = useRef<TiptapDocument | null>(null);
  const sendTimerRef = useRef<number | null>(null);

  const lastSentCursorRef = useRef<string | null>(null);
  const pendingCursorRef = useRef<CursorPosition | null>(null);
  const cursorTimerRef = useRef<number | null>(null);

  const normalizedInitialContent = useMemo(
    () => normalizeDocument(asDocument(initialContent)),
    [initialContent],
  );

  // Once websocket sync is active, the editor store becomes the authoritative
  // source of note-body state. Until then we fall back to the initially fetched
  // REST payload so the editor can render immediately.
  const effectiveContent = editorContent ?? normalizedInitialContent;

  const flushQueuedUpdate = useCallback(() => {
    if (sendTimerRef.current !== null) {
      window.clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }

    const nextDocument = queuedDocumentRef.current;
    if (!nextDocument) {
      return;
    }

    const deltas: BlockDelta[] = buildBlockDeltas(
      lastSentDocumentRef.current,
      nextDocument,
    );

    if (deltas.length === 0) {
      lastSentDocumentRef.current = nextDocument;
      queuedDocumentRef.current = null;
      return;
    }

    const message: ClientMessage = {
      type: "content_update",
      data: {
        blocks: deltas,
      },
    };

    // We only advance our local "last sent" snapshot when the websocket accepts
    // the payload. If the socket is temporarily unavailable, we keep the queued
    // document so a later reconnect can flush the same unsent changes.
    const didSend = send(message);
    if (didSend) {
      lastSentDocumentRef.current = nextDocument;
      queuedDocumentRef.current = null;
      markContentSent();
    }
  }, [markContentSent, send]);

  const scheduleSend = useCallback(
    (nextDocument: TiptapDocument) => {
      queuedDocumentRef.current = nextDocument;

      if (sendTimerRef.current !== null) {
        window.clearTimeout(sendTimerRef.current);
      }

      sendTimerRef.current = window.setTimeout(
        flushQueuedUpdate,
        LOCAL_UPDATE_DEBOUNCE_MS,
      );
    },
    [flushQueuedUpdate],
  );

  const flushCursorUpdate = useCallback(() => {
    if (cursorTimerRef.current !== null) {
      window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
    }

    const cursor = pendingCursorRef.current;
    if (!cursor) {
      return;
    }

    const serializedCursor = JSON.stringify(cursor);
    if (serializedCursor === lastSentCursorRef.current) {
      pendingCursorRef.current = null;
      return;
    }

    const message: ClientMessage = {
      type: "cursor_move",
      data: cursor.selection
        ? {
            position: cursor.position,
            selection: cursor.selection,
          }
        : {
            position: cursor.position,
          },
    };

    const didSend = send(message);
    if (didSend) {
      lastSentCursorRef.current = serializedCursor;
      pendingCursorRef.current = null;
    }
  }, [send]);

  const scheduleCursorUpdate = useCallback(
    (cursor: CursorPosition) => {
      pendingCursorRef.current = cursor;

      if (cursorTimerRef.current !== null) {
        window.clearTimeout(cursorTimerRef.current);
      }

      cursorTimerRef.current = window.setTimeout(
        flushCursorUpdate,
        CURSOR_UPDATE_DEBOUNCE_MS,
      );
    },
    [flushCursorUpdate],
  );

  const editor = useEditor({
    extensions: [CollaborationBlockIdentityExtension, StarterKit],
    content: effectiveContent ?? "",
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none min-h-[50vh] focus:outline-none",
      },
    },
    onCreate: ({ editor: editorInstance }) => {
      // Older notes may predate collaboration ids. We normalize immediately so
      // every subsequent edit can be translated into backend-friendly block
      // deltas instead of forcing a full-document save.
      const rawDocument = editorInstance.getJSON() as TiptapDocument;
      const normalizedDocument = normalizeDocument(rawDocument);

      lastSentDocumentRef.current = normalizedDocument;
      setLocalContent(normalizedDocument);

      if (
        serializeDocument(rawDocument) !== serializeDocument(normalizedDocument)
      ) {
        applyingExternalContentRef.current = true;
        editorInstance.commands.setContent(normalizedDocument ?? "", false);
      }

      // Sending an initial cursor position ensures newly joined collaborators
      // can see this editor's caret without waiting for the first explicit
      // selection change event.
      const initialCursor = buildCursorPayload(editorInstance);
      setLocalCursor(initialCursor);
      scheduleCursorUpdate(initialCursor);
    },
    onUpdate: ({ editor: editorInstance }) => {
      const rawDocument = editorInstance.getJSON() as TiptapDocument;
      const normalizedDocument = normalizeDocument(rawDocument);

      // Remote websocket sync and first-pass normalization both flow back
      // through `setContent(..., false)`. We update local store state, but skip
      // emitting another websocket delta to avoid feedback loops.
      if (applyingExternalContentRef.current) {
        applyingExternalContentRef.current = false;
        lastSentDocumentRef.current = normalizedDocument;
        setLocalContent(normalizedDocument);
        return;
      }

      // If the edit produced new block ids, re-apply the normalized content once
      // so the underlying ProseMirror document actually carries those attrs for
      // future local diffs and remote sync.
      if (
        serializeDocument(rawDocument) !== serializeDocument(normalizedDocument)
      ) {
        applyingExternalContentRef.current = true;
        editorInstance.commands.setContent(normalizedDocument, false);
      }

      setLocalContent(normalizedDocument);
      scheduleSend(normalizedDocument);
    },
    onSelectionUpdate: ({ editor: editorInstance }) => {
      // Cursor updates are lightweight and do not affect persistence, but we
      // still debounce them so rapid caret motion does not flood the websocket.
      const localCursor = buildCursorPayload(editorInstance);
      setLocalCursor(localCursor);
      scheduleCursorUpdate(localCursor);
    },
  });

  useEffect(() => {
    return () => {
      // Flush pending collaboration payloads before the editor unmounts. The
      // backend already persists staged websocket changes on disconnect, but we
      // still want the final local edit/cursor state to be sent if the socket is
      // currently open.
      flushQueuedUpdate();
      flushCursorUpdate();

      if (sendTimerRef.current !== null) {
        window.clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }

      if (cursorTimerRef.current !== null) {
        window.clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
    };
  }, [flushCursorUpdate, flushQueuedUpdate]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const normalizedContent = normalizeDocument(effectiveContent);

    // When websocket sync updates the store, we replace the live TipTap
    // document without re-broadcasting the same content back to the server.
    // If the editor already matches the store, nothing to apply — and we must
    // not touch `lastSentDocumentRef` here, since local edits flow
    // editor → store and transiently put the two in sync before the debounced
    // websocket send runs. Advancing the "last sent" pointer in that window
    // would collapse the diff basis and produce empty deltas.
    if (
      serializeDocument(normalizedContent) ===
      serializeDocument(editor.getJSON() as TiptapDocument)
    ) {
      return;
    }

    applyingExternalContentRef.current = true;
    lastSentDocumentRef.current = normalizedContent;
    editor.commands.setContent(normalizedContent ?? "", false);
  }, [editor, effectiveContent, noteId]);

  useEffect(() => {
    if (websocketStatus !== "open") {
      return;
    }

    // If content or cursor updates were queued while the socket was reconnecting,
    // flush them as soon as the collaboration channel is healthy again.
    flushQueuedUpdate();
    flushCursorUpdate();
  }, [flushCursorUpdate, flushQueuedUpdate, websocketStatus]);

  if (!editor) {
    return (
      <LoadingState
        title="Loading editor…"
        message="Preparing the collaborative editing surface."
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <PresenceBar />
          <ConnectionBadge
            editorStatus={editorStatus}
            websocketStatus={websocketStatus}
            lastError={lastError}
          />
        </div>

        <Toolbar editor={editor} />
      </div>

      <div
        className="relative"
        data-testid="note-editor-surface"
        data-note-id={noteId}
      >
        <EditorContent
          editor={editor}
          className="mt-3"
          data-testid="note-editor-content"
        />
        <CursorOverlay editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const buttonClass = (active: boolean) =>
    `rounded px-2 py-1 text-xs font-medium transition ${
      active
        ? "bg-gray-900 text-white"
        : "bg-white text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={buttonClass(editor.isActive("bold"))}
      >
        Bold
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={buttonClass(editor.isActive("italic"))}
      >
        Italic
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={buttonClass(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={buttonClass(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={buttonClass(editor.isActive("bulletList"))}
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={buttonClass(editor.isActive("orderedList"))}
      >
        1. List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={buttonClass(editor.isActive("codeBlock"))}
      >
        Code
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={buttonClass(editor.isActive("blockquote"))}
      >
        Quote
      </button>
    </div>
  );
}

interface ConnectionBadgeProps {
  editorStatus: string;
  websocketStatus: string;
  lastError: string | null;
}

function ConnectionBadge({
  editorStatus,
  websocketStatus,
  lastError,
}: ConnectionBadgeProps) {
  const label = (() => {
    if (lastError) {
      return `Collaboration error: ${lastError}`;
    }

    if (websocketStatus === "open" && editorStatus === "open") {
      return "Live collaboration connected";
    }

    if (websocketStatus === "reconnecting") {
      return "Reconnecting collaboration…";
    }

    if (websocketStatus === "connecting") {
      return "Connecting collaboration…";
    }

    return "Collaboration unavailable";
  })();

  const colorClass =
    lastError || websocketStatus === "error"
      ? "text-red-600"
      : websocketStatus === "open"
        ? "text-emerald-600"
        : "text-amber-600";

  return (
    <span
      className={`text-xs font-medium ${colorClass}`}
      data-testid="collaboration-connection-badge"
      data-websocket-status={websocketStatus}
      data-editor-status={editorStatus}
    >
      {label}
    </span>
  );
}

export default NoteEditor;
