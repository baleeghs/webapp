export type ClassValue = string | false | null | undefined | 0;

/**
 * Joins class names, skipping falsy values: `cn('px-2', active && 'bg-accent', className)`.
 *
 * It does not resolve Tailwind conflicts (`cn('h-4', 'h-7')` keeps both, and CSS order decides).
 * Components therefore never hard-code a value callers are meant to change: expose a prop or
 * variant for it instead (see `Skeleton`, `Button`).
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
