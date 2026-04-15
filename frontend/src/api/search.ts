import apiClient from './client';
import type { SearchResponse } from '../types/api';

export const searchApi = {
  search: (
    workspaceId: string,
    q: string,
    limit = 20,
    offset = 0,
  ) =>
    apiClient
      .get<SearchResponse>(`/workspaces/${workspaceId}/search`, {
        params: { q, limit, offset },
      })
      .then((r) => r.data),
};
