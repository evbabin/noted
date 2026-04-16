import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { notesApi } from "../api/notes";
import { workspacesApi } from "../api/workspaces";
import { NoteEditor } from "../components/editor/NoteEditor";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import type {
  ApiError,
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

  const { data: workspace } = useQuery<WorkspaceWithMembers>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspacesApi.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const {
    data: note,
    isLoading,
    isError,
  } = useQuery<Note>({
    queryKey: ["note", noteId],
    queryFn: () => notesApi.get(noteId as string),
    enabled: Boolean(noteId),
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
    onMutate: () => setStatus("saving"),
    onSuccess: (updated) => {
      queryClient.setQueryData(["note", noteId], updated);

      // Keep list views fresh when the note title changes.
      queryClient.invalidateQueries({
        queryKey: ["notes", updated.notebook_id],
      });

      setStatus("saved");
    },
    onError: (err) => {
      setStatus("error");
      toast.error(extractErrorDetail(err) ?? "Failed to save note title");
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
      <div className="mx-auto max-w-3xl px-8 py-8">
        {isLoading && <p className="text-sm text-gray-500">Loading note…</p>}
        {isError && (
          <p className="text-sm text-red-600">Failed to load note.</p>
        )}

        {note && (
          <>
            <div className="mb-2 flex items-center justify-between gap-4">
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
                className="flex-1 border-0 bg-transparent text-3xl font-semibold text-gray-900 focus:outline-none focus:ring-0"
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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

function extractErrorDetail(err: unknown): string | null {
  if (isAxiosError<ApiError>(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return null;
}

export default NotePage;
