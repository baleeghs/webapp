import { describe, expect, it } from 'vitest';
import { formatCompact, formatDateTime, formatNumber, truncate } from './format';

describe('format', () => {
  it('formats numbers', () => {
    expect(formatNumber(1234.567, 'en-US')).toBe('1,234.57');
    expect(formatCompact(2_500_000, 'en-US')).toBe('2.5M');
  });

  it('formats ISO timestamps and rejects invalid ones', () => {
    expect(formatDateTime('2026-10-18T14:05:00Z', 'en-GB', 'UTC')).toBe('18 Oct 2026, 14:05');
    expect(formatDateTime('not a date', 'en-GB')).toBe('');
  });

  it('truncates with an ellipsis', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a long sentence here', 8)).toBe('a long…');
  });
});
