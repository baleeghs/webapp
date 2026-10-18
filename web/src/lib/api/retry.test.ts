import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { retryDelay, shouldRetry } from './retry';

describe('shouldRetry', () => {
  it('retries transient failures a bounded number of times', () => {
    const transient = new ApiError(503, 'unavailable', '');
    expect(shouldRetry(0, transient)).toBe(true);
    expect(shouldRetry(1, transient)).toBe(true);
    expect(shouldRetry(2, transient)).toBe(false);
  });

  it('never retries client errors or unknown throws', () => {
    expect(shouldRetry(0, new ApiError(400, 'validation_failed', ''))).toBe(false);
    expect(shouldRetry(0, new Error('bug'))).toBe(false);
  });
});

describe('retryDelay', () => {
  it('grows exponentially within jitter bounds and caps', () => {
    expect(retryDelay(0, () => 0)).toBe(250);
    expect(retryDelay(0, () => 1)).toBe(500);
    expect(retryDelay(3, () => 1)).toBe(4000);
    expect(retryDelay(10, () => 1)).toBe(10_000);
  });
});
