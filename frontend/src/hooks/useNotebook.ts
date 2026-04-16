import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notebooksApi } from '../api/notebooks';
import type { ErrorHandlingMeta } from '../lib/errors';
import type {
  Notebook,
  NotebookCreateRequest,
  NotebookUpdateRequest,
} from '../types/api';

export const notebookKeys = {
  all: ['notebooks'] as const,
  list: (workspaceId: string) =>
    [...notebookKeys.all, 'list', workspaceId] as const,
};

const notebooksErrorMeta: ErrorHandlingMeta = {
  errorMessage: 'Failed to load notebooks.',
};

export function useNotebooks(workspaceId: string | undefined) {
  return useQuery<Notebook[]>({
    queryKey: notebookKeys.list(workspaceId ?? ''),
    queryFn: () => notebooksApi.list(workspaceId as string),
    enabled: Boolean(workspaceId),
    meta: notebooksErrorMeta,
  });
}

export function useCreateNotebook(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NotebookCreateRequest) =>
      notebooksApi.create(workspaceId, data),
    meta: { errorMessage: 'Failed to create notebook.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.list(workspaceId) });
    },
  });
}

export function useUpdateNotebook(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: NotebookUpdateRequest }) =>
      notebooksApi.update(id, data),
    meta: { errorMessage: 'Failed to update notebook.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.list(workspaceId) });
    },
  });
}

export function useDeleteNotebook(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notebooksApi.remove(id),
    meta: { errorMessage: 'Failed to delete notebook.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.list(workspaceId) });
    },
  });
}

export function useReorderNotebooks(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      notebooksApi.reorder(workspaceId, orderedIds),
    meta: { errorMessage: 'Failed to reorder notebooks.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.list(workspaceId) });
    },
  });
}
