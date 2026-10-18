import { useQuery } from '@tanstack/react-query';
import { healthQuery } from '@/lib/api/health';
import { cn } from '@/lib/cn';

/** A dot in the top bar: green while the API answers, red when it does not. */
export function HealthIndicator() {
  const { data, isError, isPending } = useQuery(healthQuery);
  const label = isPending ? 'Checking API…' : isError ? 'API unreachable' : `API online (v${data?.version})`;
  return (
    <span className="flex items-center gap-1.5 text-compact-sm text-fg-muted" title={label}>
      <span
        className={cn(
          'status-dot',
          isPending ? 'text-fg-subtle' : isError ? 'text-danger' : 'status-dot-pulse text-success',
        )}
      />
      <span className="hidden sm:inline">{isError ? 'Offline' : 'API'}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
