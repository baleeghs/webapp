import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage } from './errors';

const response = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, statusText: status === 503 ? 'Service Unavailable' : '', headers });

describe('ApiError', () => {
  it('parses the server error envelope', () => {
    const err = ApiError.fromResponse(response(400, { 'x-request-id': 'req-1' }), {
      error: {
        code: 'validation_failed',
        message: 'validation failed',
        details: [{ field: 'title', message: 'must not be empty' }],
      },
    });
    expect(err.status).toBe(400);
    expect(err.code).toBe('validation_failed');
    expect(err.requestId).toBe('req-1');
    expect(err.fieldErrors()).toEqual({ title: 'must not be empty' });
  });

  it('falls back when the body is not an envelope (e.g. a proxy error page)', () => {
    const err = ApiError.fromResponse(response(503), '<html>bad gateway</html>');
    expect(err.code).toBe('unknown');
    expect(err.message).toBe('Service Unavailable');
  });

  it.each([
    [0, true],
    [408, true],
    [429, true],
    [500, true],
    [503, true],
    [501, false],
    [400, false],
    [404, false],
  ])('status %i retryable: %s', (status, retryable) => {
    expect(new ApiError(status, 'unknown', '').isRetryable).toBe(retryable);
  });

  it('gives a message for anything thrown', () => {
    expect(errorMessage(ApiError.network(new TypeError('fetch failed')))).toMatch(/reach the server/);
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('weird')).toBe('Something went wrong.');
  });
});
