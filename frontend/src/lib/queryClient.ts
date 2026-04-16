import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { extractErrorDetail, shouldRetryRequest, type ErrorHandlingMeta } from './errors';

function getMeta(source: { meta?: unknown }) {
  return source.meta as ErrorHandlingMeta | undefined;
}

function shouldToastError(meta: ErrorHandlingMeta | undefined): boolean {
  return meta?.suppressErrorToast !== true;
}

function resolveErrorMessage(
  error: unknown,
  meta: ErrorHandlingMeta | undefined,
  fallback: string,
): string {
  return meta?.errorMessage ?? extractErrorDetail(error) ?? fallback;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const meta = getMeta(query);
      if (!shouldToastError(meta)) {
        return;
      }

      toast.error(resolveErrorMessage(error, meta, 'Request failed. Please try again.'), {
        id: `query-error-${query.queryHash}`,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const meta = getMeta(mutation);
      if (!shouldToastError(meta)) {
        return;
      }

      toast.error(resolveErrorMessage(error, meta, 'Action failed. Please try again.'));
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => shouldRetryRequest(failureCount, error, 2),
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
