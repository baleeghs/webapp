import { describe, expect, it } from 'vitest';
import { relativeTime } from './time';

const now = new Date('2026-10-18T12:00:00Z');

describe('relativeTime', () => {
  it.each([
    ['2026-10-18T11:59:50Z', 'now'],
    ['2026-10-18T11:57:00Z', '3 minutes ago'],
    ['2026-10-17T12:00:00Z', 'yesterday'],
    ['2026-10-20T12:00:00Z', 'in 2 days'],
  ])('%s → %s', (iso, expected) => {
    expect(relativeTime(iso, now, 'en')).toBe(expected);
  });

  it('returns an empty string for invalid input', () => {
    expect(relativeTime('nope', now, 'en')).toBe('');
  });
});
