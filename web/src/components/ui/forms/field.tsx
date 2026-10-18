import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FieldControlProps {
  id: string;
  'aria-invalid': boolean | undefined;
  'aria-describedby': string | undefined;
}

export interface FieldProps {
  label: string;
  hint?: string;
  /** Shown instead of the hint and announced to screen readers. */
  error?: string | undefined;
  className?: string;
  /** Render prop: spread the given props onto the control so label, hint and error are wired up. */
  children: (control: FieldControlProps) => ReactNode;
}

/** Label, control, hint and error with the accessibility attributes wired up. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-compact-sm font-medium text-fg">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-compact-sm text-danger-text">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-compact-sm text-fg-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
