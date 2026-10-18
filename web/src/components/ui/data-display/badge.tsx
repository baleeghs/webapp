import { variants, type VariantProps } from '@/lib/variants';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = variants(
  'inline-flex h-(--app-density-badge-h) items-center gap-1 rounded-chip px-(--app-density-badge-px) text-compact-xs font-medium whitespace-nowrap',
  {
    tone: {
      neutral: 'bg-muted text-fg-muted',
      accent: 'bg-accent-soft text-accent-text',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      danger: 'bg-danger-soft text-danger-text',
    },
  },
  { tone: 'neutral' },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

/** A small label. Colour is never the only signal: the text says what the tone means. */
export function Badge({ tone, className, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
}
