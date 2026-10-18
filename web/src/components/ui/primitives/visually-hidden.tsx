import type { ComponentProps } from 'react';

/** Content for screen readers only (Tailwind `sr-only`). */
export function VisuallyHidden(props: ComponentProps<'span'>) {
  return <span className="sr-only" {...props} />;
}
