import type { ComponentProps } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/cn';

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  icon: IconName;
  /** Required: the accessible name, also shown as the native tooltip. */
  label: string;
}

/** A square, icon-only button. Always has an accessible name. */
export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'focus-ring app-hit inline-flex size-(--app-density-control-h-sm) shrink-0 items-center justify-center rounded-md',
        'text-fg-muted transition-colors duration-(--duration-fast) hover:bg-hover hover:text-fg disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size="md" />
    </button>
  );
}
