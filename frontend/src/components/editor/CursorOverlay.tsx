import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";

import {
  selectPresenceUsers,
  usePresenceStore,
} from "../../stores/presenceStore";
import type { PresenceEntry } from "../../stores/presenceStore";

interface CursorOverlayProps {
  editor: Editor | null;
}

/**
 * A rendered caret/selection overlay for a remote collaborator.
 *
 * Positions are derived from ProseMirror coordinates so the overlay can stay in
 * sync with the live editor DOM. We keep rendering defensive because remote
 * cursor positions can briefly point at stale document locations during
 * concurrent edits or reconnects.
 */
interface CursorOverlayItem {
  userId: string;
  displayName: string;
  color: string;
  top: number;
  left: number;
  height: number;
  selection?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * Render remote collaborator cursors on top of the editor surface.
 *
 * The current backend sends cursor positions as document offsets. TipTap /
 * ProseMirror already knows how to translate those offsets into viewport
 * coordinates, so this component projects remote presence state into absolutely
 * positioned overlays relative to the editor container.
 */
export function CursorOverlay({ editor }: CursorOverlayProps) {
  const presenceUsers = usePresenceStore(selectPresenceUsers);
  const [items, setItems] = useState<CursorOverlayItem[]>([]);

  const collaboratorsWithPositions = useMemo(
    () =>
      presenceUsers.filter(
        (user) =>
          typeof user.position === "number" && Number.isFinite(user.position),
      ),
    [presenceUsers],
  );

  useEffect(() => {
    if (!editor) {
      setItems([]);
      return;
    }

    const calculateOverlayItems = () => {
      const editorElement = editor.view.dom as HTMLElement | null;
      if (!editorElement) {
        setItems([]);
        return;
      }

      const container = editorElement.parentElement as HTMLElement | null;
      if (!container) {
        setItems([]);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const nextItems: CursorOverlayItem[] = collaboratorsWithPositions
        .map((user) => buildCursorOverlayItem(editor, user, containerRect))
        .filter((item): item is CursorOverlayItem => item !== null);

      setItems(nextItems);
    };

    calculateOverlayItems();

    // Recompute overlay positions whenever the document layout changes. This
    // keeps remote cursors visually anchored even when local edits reflow the
    // content without an explicit remote cursor event.
    const handleEditorTransaction = () => {
      calculateOverlayItems();
    };

    const handleViewportChange = () => {
      calculateOverlayItems();
    };

    editor.on("transaction", handleEditorTransaction);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      editor.off("transaction", handleEditorTransaction);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [collaboratorsWithPositions, editor]);

  if (!editor || items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="remote-cursor-overlay"
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
    >
      {items.map((item) => (
        <div key={item.userId}>
          {item.selection ? (
            <div
              className="absolute rounded-sm opacity-20"
              style={{
                left: item.selection.left,
                top: item.selection.top,
                width: item.selection.width,
                height: item.selection.height,
                backgroundColor: item.color,
              }}
            />
          ) : null}

          <div
            className="absolute w-[2px] rounded-full"
            data-user-id={item.userId}
            data-user-name={item.displayName}
            style={{
              left: item.left,
              top: item.top,
              height: Math.max(item.height, 20),
              backgroundColor: item.color,
            }}
          >
            <div
              data-testid={`remote-cursor-${item.userId}`}
              className="absolute left-0 top-0 -translate-x-1/2 rounded-md px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-sm"
              style={{
                backgroundColor: item.color,
                transform: "translate(-50%, calc(-100% - 4px))",
              }}
            >
              {item.displayName}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Convert a presence entry into an overlay item. If the remote position no
 * longer maps into the current document, we drop the overlay instead of
 * throwing, because cursor messages can arrive slightly behind document sync.
 */
function buildCursorOverlayItem(
  editor: Editor,
  user: PresenceEntry,
  containerRect: DOMRect,
): CursorOverlayItem | null {
  if (typeof user.position !== "number" || !Number.isFinite(user.position)) {
    return null;
  }

  const cursorCoords = getRelativeCoords(
    editor,
    clampPosition(editor, user.position),
    containerRect,
  );
  if (!cursorCoords) {
    return null;
  }

  const selection = buildSelectionOverlay(editor, user, containerRect);

  return {
    userId: user.user_id,
    displayName: user.display_name,
    color: user.color,
    left: cursorCoords.left,
    top: cursorCoords.top,
    height: Math.max(cursorCoords.bottom - cursorCoords.top, 18),
    selection,
  };
}

/**
 * Clamp positions into the valid ProseMirror document range so a stale or
 * slightly out-of-date remote cursor does not crash coordinate resolution.
 */
function clampPosition(editor: Editor, position: number): number {
  const maxPosition = editor.state.doc.content.size;
  return Math.max(0, Math.min(Math.floor(position), maxPosition));
}

function getRelativeCoords(
  editor: Editor,
  position: number,
  containerRect: DOMRect,
): { left: number; top: number; bottom: number } | null {
  try {
    const coords = editor.view.coordsAtPos(position);
    return {
      left: coords.left - containerRect.left,
      top: coords.top - containerRect.top,
      bottom: coords.bottom - containerRect.top,
    };
  } catch {
    return null;
  }
}

/**
 * Render a lightweight selection highlight when the remote user has a visible
 * range. For simplicity we only render single-line selections here; multi-line
 * selections can be added later without changing the cursor contract.
 */
function buildSelectionOverlay(
  editor: Editor,
  user: PresenceEntry,
  containerRect: DOMRect,
): CursorOverlayItem["selection"] | undefined {
  const selection = user.selection;
  if (!selection) {
    return undefined;
  }

  const from = clampPosition(editor, Math.min(selection.from, selection.to));
  const to = clampPosition(editor, Math.max(selection.from, selection.to));

  if (from === to) {
    return undefined;
  }

  const startCoords = getRelativeCoords(editor, from, containerRect);
  const endCoords = getRelativeCoords(editor, to, containerRect);

  if (!startCoords || !endCoords) {
    return undefined;
  }

  // Keep the first implementation intentionally simple: only render a single
  // rectangle when both endpoints land on the same visual line.
  if (Math.abs(startCoords.top - endCoords.top) > 4) {
    return undefined;
  }

  return {
    left: Math.min(startCoords.left, endCoords.left),
    top: Math.min(startCoords.top, endCoords.top),
    width: Math.max(Math.abs(endCoords.left - startCoords.left), 4),
    height: Math.max(startCoords.bottom - startCoords.top, 18),
  };
}

export default CursorOverlay;
