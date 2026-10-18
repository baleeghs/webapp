import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  /** Usually the primary action that fills the empty state (e.g. "New note"). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon = 'INFO', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <Icon name={icon} size="2xl" className="text-fg-subtle" />
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="text-md font-semibold text-fg">{title}</h2>
        {description && <p className="text-compact-base text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
