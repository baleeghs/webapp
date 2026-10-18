import { useId } from 'react';
import { cn } from '@/lib/cn';
import { PALETTES, type Palette } from '@/lib/appearance';
import { PalettePreview } from './palette-preview';

export interface PalettePickerProps {
  value: Palette;
  onChange: (palette: Palette) => void;
  /** Id of the element that labels the group (the setting row's label). */
  labelledBy?: string;
}

/**
 * Palette choice as cards with a light and dark preview of each. Native radios underneath, so
 * arrow keys, focus and screen readers work without extra code. A palette added to
 * gen/palettes.mts appears here automatically.
 */
export function PalettePicker({ value, onChange, labelledBy }: PalettePickerProps) {
  const name = useId();
  return (
    // Its own container, so the grid follows the space it gets: one card per row on phones, two on
    // tablets, 4 × 4 on wide screens.
    <div className="@container">
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-4"
      >
        {PALETTES.map((palette) => {
          const selected = palette.name === value;
          return (
            // Inactive cards are dimmed (preview faded, name muted) so the active card and the one
            // under the pointer or keyboard focus stand out. Names stay at readable contrast.
            <label
              key={palette.name}
              className={cn(
                'group flex cursor-pointer flex-col gap-2 rounded-md border p-2 transition-colors',
                'has-focus-visible:ring-2 has-focus-visible:ring-ring',
                selected
                  ? 'border-accent bg-surface-raised shadow-sm ring-1 ring-accent'
                  : 'border-border bg-surface hover:border-border-hover hover:bg-surface-raised hover:shadow-sm',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                value={palette.name}
                checked={selected}
                onChange={() => onChange(palette.name)}
              />
              <span
                className={cn(
                  'transition-opacity duration-(--duration-fast)',
                  !selected && 'opacity-80 group-hover:opacity-100 group-has-focus-visible:opacity-100',
                )}
              >
                <PalettePreview palette={palette.name} />
              </span>
              <span
                className={cn(
                  'flex items-center justify-between px-0.5 text-compact-base font-medium transition-colors',
                  selected ? 'text-fg' : 'text-fg-muted group-hover:text-fg group-has-focus-visible:text-fg',
                )}
              >
                {palette.label}
                {selected && <span className="text-compact-xs text-accent-text">Active</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
