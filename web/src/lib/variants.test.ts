import { describe, expect, it } from 'vitest';
import { variants } from './variants';

const button = variants(
  'btn',
  { tone: { primary: 'bg-accent', ghost: 'bg-transparent' }, size: { sm: 'h-8', md: 'h-9' } },
  { tone: 'primary', size: 'md' },
);

describe('variants', () => {
  it('applies defaults', () => {
    expect(button()).toBe('btn bg-accent h-9');
  });

  it('applies a selection, falling back per key', () => {
    expect(button({ size: 'sm' })).toBe('btn bg-accent h-8');
    expect(button({ tone: 'ghost', size: null })).toBe('btn bg-transparent h-9');
  });
});
