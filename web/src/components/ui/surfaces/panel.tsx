import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PanelProps {
  title?: ReactNode;
  /** Right-aligned in the header, e.g. a "View all" link. */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** A card with an optional header and footer: the standard container for a block of content. */
export function Panel({ title, actions, footer, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn('card flex flex-col', className)}>
      {(title || actions) && (
        <header className="card-header">
          {title && <h2 className="min-w-0 flex-1 text-compact-base font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={cn('card-body flex-1', bodyClassName)}>{children}</div>
      {footer && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}
