import type { VariantProps } from '@/lib/variants';
import type { ComponentProps, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/cn';
import { Spinner } from '../feedback/spinner';
import { buttonVariants } from './button-variants';

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  icon?: IconName;
  /** Shows a spinner and disables the button, keeping its width. */
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant, size, icon, loading = false, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon && <Icon name={icon} size="sm" />}
      {children}
    </button>
  );
}
