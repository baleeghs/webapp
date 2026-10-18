import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins class names in order', () => {
    expect(cn('px-2 py-1', 'text-fg')).toBe('px-2 py-1 text-fg');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 0, '', 'b')).toBe('a b');
  });
});
