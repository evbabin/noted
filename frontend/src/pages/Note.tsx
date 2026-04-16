import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { notesApi } from "../api/notes";
import { workspacesApi } from "../api/workspaces";
import { NoteEditor } from "../components/editor/NoteEditor";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/ui/LoadingState";
import type {
  Note,
  NoteUpdateRequest,
  WorkspaceWithMembers,
} from "../types/api";

const TITLE_AUTOSAVE_DEBOUNCE_MS = 1000;

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export function NotePage() {
  const { workspaceId, noteId } = useParams<{
    workspaceId: string;
    noteId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: workspace, refetch: refetchWorkspace } = useQuery<WorkspaceWithMembers>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspacesApi.get(workspaceId as string),
    enabled: Boolean(workspaceId),
    meta: { errorMessage: "Failed to load workspace." },
  });

  const {
    data: note,
    isLoading,
    isError,
    refetch: refetchNote,
  } = useQuery<Note>({
    queryKey: ["note", noteId],
    queryFn: () => notesApi.get(noteId as string),
    enabled: Boolean(noteId),
    meta: { errorMessage: "Failed to load note." },
  });

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Title edits still use the existing REST autosave flow. The note body now
  // belongs to the websocket collaboration path inside `NoteEditor`, so we only
  // queue `title` patches here to avoid racing collaborative body updates.
  const pendingTitleRef = useRef<NoteUpdateRequest>({});
  const titleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setStatus("idle");
      pendingTitleRef.current = {};
    }
  }, [note?.id, note]);

  const saveTitleMutation = useMutation({
    mutationFn: (payload: NoteUpdateRequest) =>
      notesApi.update(noteId as string, payload),
    meta: { errorMessage: "Failed to save note title." },
    onMutate: () => setStatus("saving"),
    onSuccess: (updated) => {
      queryClient.setQueryData(["note", noteId], updated);

      // Keep list views fresh when the note title changes.
      queryClient.invalidateQueries({
        queryKey: ["notes", updated.notebook_id],
      });

      setStatus("saved");
    },
    onError: () => {
      setStatus("error");
    },
  });

  const flushTitleSave = useCallback(() => {
    if (titleTimerRef.current !== null) {
      window.clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }

    const payload = pendingTitleRef.current;
    if (Object.keys(payload).length === 0) {
      return;
    }

    pendingTitleRef.current = {};
    saveTitleMutation.mutate(payload);
  }, [saveTitleMutation]);

  const scheduleTitleSave = useCallback(
    (patch: NoteUpdateRequest) => {
      pendingTitleRef.current = { ...pendingTitleRef.current, ...patch };
      setStatus("pending");

      if (titleTimerRef.current !== null) {
        window.clearTimeout(titleTimerRef.current);
      }

      titleTimerRef.current = window.setTimeout(
        flushTitleSave,
        TITLE_AUTOSAVE_DEBOUNCE_MS,
      );
    },
    [flushTitleSave],
  );

  useEffect(() => {
    return () => {
      // Flush any unsaved title changes on navigation. Body content is persisted
      // by the collaborative websocket flow, so we intentionally do not send a
      // REST content patch here anymore.
      if (titleTimerRef.current !== null) {
        window.clearTimeout(titleTimerRef.current);
        titleTimerRef.current = null;
      }

      const payload = pendingTitleRef.current;
      if (Object.keys(payload).length > 0 && noteId) {
        notesApi.update(noteId, payload).catch(() => {});
        pendingTitleRef.current = {};
      }
    };
  }, [noteId]);

  if (!workspaceId || !noteId) {
    return null;
  }

  return (
    <AppShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name}
      title={title || note?.title}
    >
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {isLoading && (
          <LoadingState
            title="Loading note…"
            message="Syncing the latest note content and collaborators."
          />
        )}
        {isError && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load note.{` `}
            <button
              type="button"
              onClick={() => {
                void refetchWorkspace();
                void refetchNote();
              }}
              className="underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {note && (
          <>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <input
                type="text"
                aria-label="Note title"
                data-testid="note-title-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleTitleSave({ title: e.target.value });
                }}
                onBlur={flushTitleSave}
                placeholder="Untitled"
                className="min-w-0 flex-1 border-0 bg-transparent text-2xl font-semibold text-gray-900 focus:outline-none focus:ring-0 sm:text-3xl"
              />
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  data-testid="note-open-quizzes"
                  onClick={() => navigate(`/notes/${note.id}/quizzes`)}
                >
                  Quizzes
                </Button>
                <SaveIndicator status={status} version={note.version} />
              </div>
            </div>

            <NoteEditor noteId={note.id} initialContent={note.content} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function SaveIndicator({
  status,
  version,
}: {
  status: SaveStatus;
  version: number;
}) {
  const label = (() => {
    switch (status) {
      case "pending":
        return "Unsaved title…";
      case "saving":
        return "Saving title…";
      case "saved":
        return `Title saved · v${version}`;
      case "error":
        return "Title save failed";
      default:
        return `Live sync · v${version}`;
    }
  })();

  const color =
    status === "error"
      ? "text-red-600"
      : status === "saving" || status === "pending"
        ? "text-amber-600"
        : "text-gray-500";

  return <span className={`whitespace-nowrap text-xs ${color}`}>{label}</span>;
}

export default NotePage;
