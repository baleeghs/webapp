import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

export const APP_NAME = 'App';

const BARS = [
  { x: 5, y: 16, h: 11 },
  { x: 13.5, y: 9, h: 18 },
  { x: 22, y: 5, h: 22, alert: true },
];

export interface LogoProps {
  /** Show the product name next to the mark. */
  withName?: boolean;
  /** `intro` plays once; `loading` waves while busy (styles/components/brand.css). */
  animation?: 'intro' | 'loading';
  className?: string;
  /** Size of the mark (default `size-6`). */
  markClassName?: string;
}

/** Product mark. Replace the bars and APP_NAME with your brand; colours come from --app-logo-*. */
export function Logo({ withName = true, animation, className, markClassName = 'size-6' }: LogoProps) {
  return (
    <span className={cn('app-logo inline-flex items-center gap-2', animation && `app-logo-${animation}`, className)}>
      <svg viewBox="0 0 32 32" className={markClassName} aria-hidden>
        {BARS.map((bar, i) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={bar.y}
            width="5"
            height={bar.h}
            rx="1"
            className={cn('app-logo-bar', bar.alert && 'app-logo-bar-alert')}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
      </svg>
      {withName ? (
        <span className="app-logo-text text-md">{APP_NAME}</span>
      ) : (
        <span className="sr-only">{APP_NAME}</span>
      )}
    </span>
  );
}
