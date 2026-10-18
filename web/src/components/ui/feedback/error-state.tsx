import { errorMessage, isApiError } from '@/lib/api/errors';
import { Button } from '../actions/button';
import { EmptyState } from './empty-state';

export interface ErrorStateProps {
  error: unknown;
  /** Shows a "Try again" button. */
  onRetry?: () => void;
  title?: string;
  className?: string;
}

/** The standard "this failed to load" block, with the request id for support when there is one. */
export function ErrorState({ error, onRetry, title = 'Could not load this', className }: ErrorStateProps) {
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <EmptyState
      icon={isApiError(error) && error.code === 'network_error' ? 'CLOUD_OFF' : 'ERROR'}
      title={title}
      description={
        <>
          {errorMessage(error)}
          {requestId && (
            <span className="mt-1 block font-mono text-compact-xs text-fg-subtle">Request ID: {requestId}</span>
          )}
        </>
      }
      action={
        onRetry && (
          <Button icon="REFRESH" onClick={onRetry}>
            Try again
          </Button>
        )
      }
      {...(className && { className })}
    />
  );
}
