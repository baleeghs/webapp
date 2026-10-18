import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { retryDelay, shouldRetry } from '@/lib/api/retry';

/**
 * One QueryClient per app (and per test). Defaults: data is fresh for 30 s, transient failures
 * retry with backoff (lib/api/retry.ts), and a failed mutation shows a toast unless the mutation
 * handles its own errors (`meta: { toastOnError: false }`, e.g. forms that show field errors).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, retryDelay: (attempt) => retryDelay(attempt) },
      mutations: { retry: false },
    },
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.toastOnError === false) return;
        toast.error('Action failed', errorMessage(error));
      },
    }),
  });
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Set to false when the caller shows the error itself (e.g. inline form errors). */
      toastOnError?: boolean;
    };
  }
}
