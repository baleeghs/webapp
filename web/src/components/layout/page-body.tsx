import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The padded, width-capped content area under a PageHeader. Sections stack with the section gap.
 * It is a container (`@container`), so children can adapt to its width with `@md:` variants.
 */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('app-chrome-bar app-sections @container pb-10', className)}>{children}</div>;
}
