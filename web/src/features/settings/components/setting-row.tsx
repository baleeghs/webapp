import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SettingRowProps {
  label: string;
  /** One line under the control explaining the effect. */
  hint?: ReactNode;
  /** Put the label above and let the control span the whole width (large pickers, previews). */
  wide?: boolean;
  /** Render prop: receives the label's id for `aria-labelledby` on the control. */
  children: (labelId: string) => ReactNode;
}

/**
 * One setting: label on the left, control and hint on the right. Stacks on narrow containers.
 * Use inside {@link SettingsGrid}.
 */
export function SettingRow({ label, hint, wide = false, children }: SettingRowProps) {
  const id = useId();
  return (
    <>
      <span id={id} className={cn('pt-1 text-compact-base text-fg-muted @md:pt-0', wide && '@md:col-span-2')}>
        {label}
      </span>
      <div className={cn('flex min-w-0 flex-col gap-1', wide && '@md:col-span-2')}>
        {children(id)}
        {hint && <span className="text-compact-xs text-fg-subtle">{hint}</span>}
      </div>
    </>
  );
}

/** Two-column grid for {@link SettingRow}s (label column 10rem from the `@md` container width). */
export function SettingsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-x-4 gap-y-2 @md:grid-cols-[10rem_minmax(0,1fr)] @md:gap-y-5">
      {children}
    </div>
  );
}
