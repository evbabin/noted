import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { notesApi } from "../api/notes";
import { workspacesApi } from "../api/workspaces";
import { NoteEditor } from "../components/editor/NoteEditor";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/ui/LoadingState";
import { Spinner } from "../components/ui/Spinner";
import type {
  Note,
  NoteUpdateRequest,
  WorkspaceWithMembers,
} from "../types/api";

const TITLE_AUTOSAVE_DEBOUNCE_MS = 1000;
const CONTENT_AUTOSAVE_DEBOUNCE_MS = 2000;

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
  const [titleStatus, setTitleStatus] = useState<SaveStatus>("idle");
  const [contentStatus, setContentStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const pendingTitleRef = useRef<NoteUpdateRequest>({});
  const titleTimerRef = useRef<number | null>(null);
  const pendingContentRef = useRef<unknown>(null);
  const contentTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setTitleStatus("idle");
      pendingTitleRef.current = {};
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Title save (REST, debounced) ─────────────────────────────────────────

  const saveTitleMutation = useMutation({
    mutationFn: (payload: NoteUpdateRequest) =>
      notesApi.update(noteId as string, payload),
    meta: { errorMessage: "Failed to save note title." },
    onMutate: () => setTitleStatus("saving"),
    onSuccess: (updated) => {
      queryClient.setQueryData(["note", noteId], updated);
      queryClient.invalidateQueries({ queryKey: ["notes", updated.notebook_id] });
      setTitleStatus("saved");
      setLastSaved(new Date());
    },
    onError: () => setTitleStatus("error"),
  });

  const flushTitleSave = useCallback(() => {
    if (titleTimerRef.current !== null) {
      window.clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    const payload = pendingTitleRef.current;
    if (Object.keys(payload).length === 0) return;
    pendingTitleRef.current = {};
    saveTitleMutation.mutate(payload);
  }, [saveTitleMutation]);

  const scheduleTitleSave = useCallback(
    (patch: NoteUpdateRequest) => {
      pendingTitleRef.current = { ...pendingTitleRef.current, ...patch };
      setTitleStatus("pending");
      if (titleTimerRef.current !== null) window.clearTimeout(titleTimerRef.current);
      titleTimerRef.current = window.setTimeout(flushTitleSave, TITLE_AUTOSAVE_DEBOUNCE_MS);
    },
    [flushTitleSave],
  );

  // ── Content save (REST, debounced) ───────────────────────────────────────

  const flushContentSave = useCallback(async () => {
    if (contentTimerRef.current !== null) {
      window.clearTimeout(contentTimerRef.current);
      contentTimerRef.current = null;
    }
    const content = pendingContentRef.current;
    if (content === null || !noteId) return;
    pendingContentRef.current = null;
    setContentStatus("saving");
    try {
      const updated = await notesApi.update(noteId, { content });
      queryClient.setQueryData(["note", noteId], updated);
      setContentStatus("saved");
      setLastSaved(new Date());
    } catch {
      setContentStatus("error");
    }
  }, [noteId, queryClient]);

  const handleContentChange = useCallback(
    (content: unknown) => {
      pendingContentRef.current = content;
      setContentStatus("pending");
      if (contentTimerRef.current !== null) window.clearTimeout(contentTimerRef.current);
      contentTimerRef.current = window.setTimeout(
        () => { void flushContentSave(); },
        CONTENT_AUTOSAVE_DEBOUNCE_MS,
      );
    },
    [flushContentSave],
  );

  // ── Ctrl+S ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        flushTitleSave();
        void flushContentSave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [flushTitleSave, flushContentSave]);

  // ── Flush on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (titleTimerRef.current !== null) window.clearTimeout(titleTimerRef.current);
      const titlePayload = pendingTitleRef.current;
      if (Object.keys(titlePayload).length > 0 && noteId) {
        notesApi.update(noteId, titlePayload).catch(() => {});
        pendingTitleRef.current = {};
      }

      if (contentTimerRef.current !== null) window.clearTimeout(contentTimerRef.current);
      const content = pendingContentRef.current;
      if (content !== null && noteId) {
        notesApi.update(noteId, { content }).catch(() => {});
        pendingContentRef.current = null;
      }
    };
  }, [noteId]);

  if (!workspaceId || !noteId) return null;

  // Combined status: content save takes precedence over title save for display
  const displayStatus: SaveStatus =
    contentStatus === "saving" || titleStatus === "saving" ? "saving"
    : contentStatus === "pending" || titleStatus === "pending" ? "pending"
    : contentStatus === "error" || titleStatus === "error" ? "error"
    : contentStatus === "saved" || titleStatus === "saved" ? "saved"
    : "idle";

  return (
    <AppShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name}
      title={title || note?.title}
    >
      <div className="mx-auto max-w-4xl px-4 py-6 text-gray-900 transition-colors dark:text-zinc-100 sm:px-6 sm:py-10">
        {isLoading && (
          <LoadingState
            title="Loading note…"
            message="Syncing the latest note content and collaborators."
          />
        )}
        {isError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
          >
            Failed to load note.{" "}
            <button
              type="button"
              onClick={() => { void refetchWorkspace(); void refetchNote(); }}
              className="font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {note && (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">
                  Note
                </p>
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
                  className="min-w-0 w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-0 dark:text-zinc-100 dark:placeholder-zinc-600 sm:text-4xl"
                />
              </div>
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
                <SaveIndicator status={displayStatus} lastSaved={lastSaved} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={displayStatus === "saving"}
                  onClick={() => { flushTitleSave(); void flushContentSave(); }}
                  title="Save (Ctrl+S)"
                >
                  {displayStatus === "saving" ? (
                    <>
                      <Spinner className="mr-1.5 h-3.5 w-3.5" />
                      Saving…
                    </>
                  ) : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  data-testid="note-open-quizzes"
                  onClick={() => navigate(`/notes/${note.id}/quizzes`, { state: { workspaceId } })}
                >
                  Quizzes
                </Button>
              </div>
            </div>

            <NoteEditor
              noteId={note.id}
              initialContent={note.content}
              onContentChange={handleContentChange}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

function SaveIndicator({
  status,
  lastSaved,
}: {
  status: SaveStatus;
  lastSaved: Date | null;
}) {
  const label = (() => {
    switch (status) {
      case "pending": return "Unsaved changes…";
      case "saving":  return "Saving…";
      case "error":   return "Save failed";
      case "saved":   return lastSaved ? `Saved ${formatTime(lastSaved)}` : "Saved";
      default:        return lastSaved ? `Last saved ${formatTime(lastSaved)}` : "No unsaved changes";
    }
  })();

  const color =
    status === "error"   ? "text-red-600 dark:text-red-300" :
    status === "saving" || status === "pending" ? "text-amber-600 dark:text-amber-400" :
    "text-gray-500 dark:text-zinc-400";

  return <span className={`whitespace-nowrap text-xs ${color}`}>{label}</span>;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default NotePage;
