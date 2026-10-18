import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioGroupBaseProps<T extends string> {
  value: T;
  options: readonly RadioOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** Either a visible `label`, or `labelledBy` pointing at a label rendered elsewhere. */
export type RadioGroupProps<T extends string> = RadioGroupBaseProps<T> &
  ({ label: string; labelledBy?: never } | { labelledBy: string; label?: never });

/** A segmented control built on native radios: arrow keys, focus and forms work out of the box. */
export function RadioGroup<T extends string>({
  label,
  labelledBy,
  value,
  options,
  onChange,
  className,
}: RadioGroupProps<T>) {
  const name = useId();
  const segments = (
    <div className="tabs-compact">
      {options.map((option) => (
        <label
          key={option.value}
          className="tab-compact cursor-pointer has-focus-visible:ring-2 has-focus-visible:ring-ring"
        >
          <input
            type="radio"
            className="sr-only"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );

  if (labelledBy) {
    return (
      <div role="radiogroup" aria-labelledby={labelledBy} className={className}>
        {segments}
      </div>
    );
  }
  return (
    <fieldset className={cn('flex flex-col gap-1.5', className)}>
      <legend className="mb-1.5 text-compact-sm font-medium text-fg">{label}</legend>
      {segments}
    </fieldset>
  );
}
