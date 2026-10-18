import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ErrorState } from '@/components/ui';

/**
 * The router's default error component: any loader, `useSuspenseQuery` or render error inside a
 * route lands here. "Try again" resets failed queries and re-runs the route's loaders.
 */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorReset = useQueryErrorResetBoundary();

  useEffect(() => {
    queryErrorReset.reset();
  }, [queryErrorReset]);

  return (
    <div className="app-chrome px-(--app-density-page-px) py-10">
      <ErrorState error={error} title="This page failed to load" onRetry={() => void router.invalidate()} />
    </div>
  );
}
