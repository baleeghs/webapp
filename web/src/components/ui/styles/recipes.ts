/**
 * Class recipes shared by several components. Components compose these instead of repeating long
 * utility strings, so the look of every control changes in one place.
 */

/** Height, padding, text and border shared by text inputs, selects and textareas. */
export const control =
  'w-full rounded-xs border border-border-control bg-input px-(--app-density-field-px) text-compact-base text-fg ' +
  'transition-colors duration-(--duration-fast) placeholder:text-fg-subtle hover:border-border-hover ' +
  'focus-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger';

/** Single-line controls get the density's control height. */
export const controlHeight = 'h-(--app-density-control-h)';
