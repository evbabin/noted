import apiClient from './client';
import type {
  Notebook,
  NotebookCreateRequest,
  NotebookUpdateRequest,
} from '../types/api';

export const notebooksApi = {
  list: (workspaceId: string) =>
    apiClient
      .get<Notebook[]>(`/workspaces/${workspaceId}/notebooks`)
      .then((r) => r.data),

  create: (workspaceId: string, data: NotebookCreateRequest) =>
    apiClient
      .post<Notebook>(`/workspaces/${workspaceId}/notebooks`, data)
      .then((r) => r.data),

  update: (id: string, data: NotebookUpdateRequest) =>
    apiClient.patch<Notebook>(`/notebooks/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<void>(`/notebooks/${id}`).then((r) => r.data),

  reorder: (workspaceId: string, orderedIds: string[]) =>
    apiClient
      .post<{ status: string }>(
        `/workspaces/${workspaceId}/notebooks/reorder`,
        { ordered_ids: orderedIds },
      )
      .then((r) => r.data),
};
