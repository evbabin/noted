import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { workspacesApi } from '../api/workspaces';
import { notesApi } from '../api/notes';
import { AppShell } from '../components/layout/AppShell';
import { NoteEditor } from '../components/editor/NoteEditor';
import type { ApiError, Note, NoteUpdateRequest, WorkspaceWithMembers } from '../types/api';

const AUTOSAVE_DEBOUNCE_MS = 1000;

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function NotePage() {
  const { workspaceId, noteId } = useParams<{ workspaceId: string; noteId: string }>();
  const queryClient = useQueryClient();

  const { data: workspace } = useQuery<WorkspaceWithMembers>({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const {
    data: note,
    isLoading,
    isError,
  } = useQuery<Note>({
    queryKey: ['note', noteId],
    queryFn: () => notesApi.get(noteId as string),
    enabled: Boolean(noteId),
  });

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const pendingRef = useRef<NoteUpdateRequest>({});
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setStatus('idle');
      pendingRef.current = {};
    }
  }, [note?.id, note]);

  const saveMutation = useMutation({
    mutationFn: (payload: NoteUpdateRequest) =>
      notesApi.update(noteId as string, payload),
    onMutate: () => setStatus('saving'),
    onSuccess: (updated) => {
      queryClient.setQueryData(['note', noteId], updated);
      queryClient.invalidateQueries({
        queryKey: ['notes', updated.notebook_id],
      });
      setStatus('saved');
    },
    onError: (err) => {
      setStatus('error');
      toast.error(extractErrorDetail(err) ?? 'Failed to save note');
    },
  });

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const payload = pendingRef.current;
    if (Object.keys(payload).length === 0) return;
    pendingRef.current = {};
    saveMutation.mutate(payload);
  }, [saveMutation]);

  const scheduleSave = useCallback(
    (patch: NoteUpdateRequest) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      setStatus('pending');
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      // Flush pending changes on unmount / note change.
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const payload = pendingRef.current;
      if (Object.keys(payload).length > 0 && noteId) {
        notesApi.update(noteId, payload).catch(() => {});
        pendingRef.current = {};
      }
    };
  }, [noteId]);

  if (!workspaceId || !noteId) return null;

  return (
    <AppShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name}
      title={title || note?.title}
    >
      <div className="mx-auto max-w-3xl px-8 py-8">
        {isLoading && <p className="text-sm text-gray-500">Loading note…</p>}
        {isError && <p className="text-sm text-red-600">Failed to load note.</p>}
        {note && (
          <>
            <div className="mb-2 flex items-center justify-between gap-4">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave({ title: e.target.value });
                }}
                onBlur={flush}
                placeholder="Untitled"
                className="flex-1 border-0 bg-transparent text-3xl font-semibold text-gray-900 focus:outline-none focus:ring-0"
              />
              <SaveIndicator status={status} version={note.version} />
            </div>
            <NoteEditor
              noteId={note.id}
              initialContent={note.content}
              onChange={(content) => scheduleSave({ content })}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

function SaveIndicator({ status, version }: { status: SaveStatus; version: number }) {
  const label = (() => {
    switch (status) {
      case 'pending':
        return 'Unsaved changes…';
      case 'saving':
        return 'Saving…';
      case 'saved':
        return `Saved · v${version}`;
      case 'error':
        return 'Save failed';
      default:
        return `v${version}`;
    }
  })();
  const color =
    status === 'error'
      ? 'text-red-600'
      : status === 'saving' || status === 'pending'
      ? 'text-amber-600'
      : 'text-gray-500';
  return <span className={`whitespace-nowrap text-xs ${color}`}>{label}</span>;
}

function extractErrorDetail(err: unknown): string | null {
  if (isAxiosError<ApiError>(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return null;
}

export default NotePage;
