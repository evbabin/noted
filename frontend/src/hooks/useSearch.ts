import { useQuery } from '@tanstack/react-query';

import { searchApi } from '../api/search';
import type { ErrorHandlingMeta } from '../lib/errors';
import type { SearchResponse } from '../types/api';

export const searchKeys = {
  all: ['search'] as const,
  query: (workspaceId: string, q: string, limit: number, offset: number) =>
    [...searchKeys.all, workspaceId, q, limit, offset] as const,
};

const searchErrorMeta: ErrorHandlingMeta = {
  errorMessage: 'Search failed. Please try again.',
  suppressErrorToast: true,
};

interface UseSearchOptions {
  workspaceId: string | undefined;
  query: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useSearch({
  workspaceId,
  query,
  limit = 20,
  offset = 0,
  enabled = true,
}: UseSearchOptions) {
  const trimmed = query.trim();
  return useQuery<SearchResponse>({
    queryKey: searchKeys.query(workspaceId ?? '', trimmed, limit, offset),
    queryFn: () =>
      searchApi.search(workspaceId as string, trimmed, limit, offset),
    enabled: enabled && Boolean(workspaceId) && trimmed.length > 0,
    staleTime: 60_000,
    meta: searchErrorMeta,
  });
}
