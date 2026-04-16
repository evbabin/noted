import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notesApi } from '../api/notes';
import type { ErrorHandlingMeta } from '../lib/errors';
import type {
  Note,
  NoteCreateRequest,
  NoteSummary,
  NoteUpdateRequest,
} from '../types/api';

export const noteKeys = {
  all: ['notes'] as const,
  listInNotebook: (notebookId: string) =>
    [...noteKeys.all, 'list', 'notebook', notebookId] as const,
  detail: (id: string) => [...noteKeys.all, 'detail', id] as const,
};

const notesListErrorMeta: ErrorHandlingMeta = {
  errorMessage: 'Failed to load notes.',
};

const noteDetailErrorMeta: ErrorHandlingMeta = {
  errorMessage: 'Failed to load note.',
};

export function useNotesInNotebook(notebookId: string | undefined) {
  return useQuery<NoteSummary[]>({
    queryKey: noteKeys.listInNotebook(notebookId ?? ''),
    queryFn: () => notesApi.listInNotebook(notebookId as string),
    enabled: Boolean(notebookId),
    meta: notesListErrorMeta,
  });
}

export function useNote(noteId: string | undefined) {
  return useQuery<Note>({
    queryKey: noteKeys.detail(noteId ?? ''),
    queryFn: () => notesApi.get(noteId as string),
    enabled: Boolean(noteId),
    meta: noteDetailErrorMeta,
  });
}

export function useCreateNote(notebookId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NoteCreateRequest) => notesApi.create(notebookId, data),
    meta: { errorMessage: 'Failed to create note.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.listInNotebook(notebookId) });
    },
  });
}

export function useUpdateNote(noteId: string, notebookId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NoteUpdateRequest) => notesApi.update(noteId, data),
    meta: { errorMessage: 'Failed to update note.' },
    onSuccess: (updated) => {
      qc.setQueryData(noteKeys.detail(noteId), updated);
      if (notebookId) {
        qc.invalidateQueries({
          queryKey: noteKeys.listInNotebook(notebookId),
        });
      }
    },
  });
}

export function useDeleteNote(notebookId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    meta: { errorMessage: 'Failed to delete note.' },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: noteKeys.detail(id) });
      if (notebookId) {
        qc.invalidateQueries({
          queryKey: noteKeys.listInNotebook(notebookId),
        });
      }
    },
  });
}
