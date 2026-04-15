import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { workspacesApi } from '../api/workspaces';
import type {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceUpdateRequest,
  WorkspaceWithMembers,
} from '../types/api';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  detail: (id: string) => [...workspaceKeys.all, 'detail', id] as const,
};

export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: workspaceKeys.list(),
    queryFn: workspacesApi.list,
  });
}

export function useWorkspace(workspaceId: string | undefined) {
  return useQuery<WorkspaceWithMembers>({
    queryKey: workspaceKeys.detail(workspaceId ?? ''),
    queryFn: () => workspacesApi.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkspaceCreateRequest) => workspacesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkspaceUpdateRequest) =>
      workspacesApi.update(workspaceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.list() });
      qc.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => workspacesApi.remove(workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}
