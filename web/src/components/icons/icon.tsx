import type { SVGProps } from 'react';
import { cn } from '@/lib/cn';
import { icons, type IconName } from './svg';

const SIZES = {
  xs: 'size-(--app-icon-xs)',
  sm: 'size-(--app-icon-sm)',
  md: 'size-(--app-icon-md)',
  lg: 'size-(--app-icon-lg)',
  xl: 'size-(--app-icon-xl)',
  '2xl': 'size-(--app-icon-2xl)',
} as const;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Density-aware size token (tokens.css `--app-icon-*`). */
  size?: keyof typeof SIZES;
  filled?: boolean;
  /** Accessible name. Omit for decorative icons next to text; they are hidden from screen readers. */
  label?: string;
}

/**
 * Inline Material Symbols icon from the generated set (svg.ts). To add one, extend ICON_MAP in
 * gen/icons.mts and run `pnpm gen:icons`.
 */
export function Icon({ name, size = 'sm', filled = false, label, className, ...props }: IconProps) {
  const glyph: { outlined?: string[]; filled?: string[] } = icons[name];
  const paths = (filled ? glyph.filled : glyph.outlined) ?? glyph.outlined ?? glyph.filled ?? [];
  return (
    <svg
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={cn('shrink-0', SIZES[size], className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...props}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
