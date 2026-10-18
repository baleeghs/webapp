import { Skeleton } from '@/components/ui';

/** Shown when a route's loader takes longer than the router's pending threshold. */
export function RoutePending() {
  return (
    <div aria-busy className="app-chrome-bar flex flex-col gap-4 pt-6">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  );
}
