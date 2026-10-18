import { variants } from '@/lib/variants';

/** Button classes, also used to style links as buttons: `<Link className={buttonVariants()}>`. */
export const buttonVariants = variants(
  'focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap ' +
    'transition-colors duration-(--duration-fast) select-none disabled:pointer-events-none disabled:opacity-50',
  {
    variant: {
      primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
      secondary: 'border border-border-control bg-surface-raised text-fg hover:border-border-hover hover:bg-hover',
      ghost: 'text-fg-muted hover:bg-hover hover:text-fg',
      danger: 'bg-danger text-danger-fg hover:opacity-90',
    },
    size: {
      sm: 'h-(--app-density-control-h-sm) px-(--app-density-control-px-sm) text-compact-sm',
      md: 'h-(--app-density-control-h) px-(--app-density-control-px) text-compact-base',
    },
  },
  { variant: 'secondary', size: 'md' },
);
