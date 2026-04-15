import apiClient from './client';
import type {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceUpdateRequest,
  WorkspaceWithMembers,
} from '../types/api';

export const workspacesApi = {
  list: () => apiClient.get<Workspace[]>('/workspaces/').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<WorkspaceWithMembers>(`/workspaces/${id}`).then((r) => r.data),

  create: (data: WorkspaceCreateRequest) =>
    apiClient.post<Workspace>('/workspaces/', data).then((r) => r.data),

  update: (id: string, data: WorkspaceUpdateRequest) =>
    apiClient.patch<Workspace>(`/workspaces/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<void>(`/workspaces/${id}`).then((r) => r.data),
};
