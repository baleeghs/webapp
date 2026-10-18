import { cn } from '@/lib/cn';

/**
 * A loading placeholder, invisible for its first 150 ms so fast loads never flash. Size it with
 * utilities, height included: `<Skeleton className="h-4 w-40" />`.
 */
export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={cn('app-skeleton', className)} />;
}
