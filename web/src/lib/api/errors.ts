import type { ErrorBody, FieldError } from './types';

/** Codes the server sends in `error.code` (docs/api/API.md), plus client-side ones. */
export type ApiErrorCode =
  'not_found' | 'validation_failed' | 'conflict' | 'unavailable' | 'internal' | 'network_error' | 'unknown';

/**
 * Every failed API call rejects with this. Components branch on `code` and `status`, never on
 * `message`, and show `message` (already user-facing) when nothing more specific fits.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  /** HTTP status; 0 when the request never got a response. */
  readonly status: number;
  readonly code: ApiErrorCode | (string & {});
  readonly details: readonly FieldError[];
  /** The server's `x-request-id`, to quote in bug reports and find the request in logs. */
  readonly requestId: string | undefined;

  constructor(
    status: number,
    code: ApiErrorCode | (string & {}),
    message: string,
    details: readonly FieldError[] = [],
    requestId?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** Builds an error from a non-2xx response and its (possibly non-JSON) body. */
  static fromResponse(response: Response, body: unknown): ApiError {
    const requestId = response.headers.get('x-request-id') ?? undefined;
    if (isErrorBody(body)) {
      const { code, message, details } = body.error;
      return new ApiError(response.status, code, message, details ?? [], requestId);
    }
    const message = response.statusText || `Request failed with status ${response.status}`;
    return new ApiError(response.status, response.status === 404 ? 'not_found' : 'unknown', message, [], requestId);
  }

  static network(cause: unknown): ApiError {
    const err = new ApiError(0, 'network_error', 'Could not reach the server. Check your connection.');
    err.cause = cause;
    return err;
  }

  /** Worth retrying: the request may succeed unchanged (network, timeouts, overload, 5xx). */
  get isRetryable(): boolean {
    return (
      this.status === 0 || this.status === 408 || this.status === 429 || (this.status >= 500 && this.status !== 501)
    );
  }

  /** Field errors keyed by field name, for forms. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isErrorBody(body: unknown): body is ErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const error = (body as { error: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

/** A user-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
