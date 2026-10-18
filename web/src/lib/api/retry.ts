import { isApiError } from './errors';

const MAX_RETRIES = 2;

/**
 * TanStack Query `retry` policy: retry only failures that may succeed unchanged (network, 5xx,
 * 429), at most twice. A 4xx will fail the same way again, so it surfaces immediately.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return isApiError(error) ? error.isRetryable : false;
}

/** Exponential backoff with full jitter, capped at 10 s. `random` is injectable for tests. */
export function retryDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(10_000, 500 * 2 ** attempt);
  return Math.round(base / 2 + random() * (base / 2));
}
