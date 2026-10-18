/** Locale-aware formatting. All functions take an optional locale for tests and SSR. */

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`;
  let fmt = numberFormats.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, fmt);
  }
  return fmt;
}

export function formatNumber(value: number, locale?: string): string {
  return numberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/** 1234 → "1.2K", 2_500_000 → "2.5M". For dense UI such as stat cards. */
export function formatCompact(value: number, locale?: string): string {
  return numberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** An ISO timestamp as a short local date and time, e.g. "18 Oct 2026, 14:05". */
export function formatDateTime(iso: string, locale?: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone && { timeZone }),
  }).format(date);
}

/** Shortens `text` to at most `max` characters, ending with an ellipsis when cut. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
