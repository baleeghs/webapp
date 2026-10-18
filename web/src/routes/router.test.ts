import { describe, expect, it } from 'vitest';
import { routeTree } from './router';
import { oneOf, positiveInt, validateNotesSearch } from './search';

describe('route tree', () => {
  it('has every page', () => {
    const paths = (routeTree.children ?? []).map((r) => (r.options as { path?: string }).path).sort();
    expect(paths).toEqual(['/', '/notes', '/notes/$noteId', '/settings']);
  });
});

/** What the router hands the validator: raw, untrusted values from the URL. */
const parse = (search: Record<string, unknown>) =>
  validateNotesSearch(search as Parameters<typeof validateNotesSearch>[0]);

describe('search params', () => {
  it('defaults the page', () => {
    expect(parse({})).toEqual({ page: 1 });
  });

  it('recovers from a hand-edited URL instead of throwing', () => {
    expect(parse({ page: -3 })).toEqual({ page: 1 });
    expect(parse({ page: 'abc' })).toEqual({ page: 1 });
    expect(parse({ page: 2.5 })).toEqual({ page: 1 });
    expect(parse({ page: '4' })).toEqual({ page: 4 });
  });

  it('has reusable helpers', () => {
    expect(positiveInt(3, 1)).toBe(3);
    expect(oneOf('desc', ['asc', 'desc'] as const, 'asc')).toBe('desc');
    expect(oneOf('sideways', ['asc', 'desc'] as const, 'asc')).toBe('asc');
  });
});
