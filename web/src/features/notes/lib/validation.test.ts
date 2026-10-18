import { describe, expect, it } from 'vitest';
import { BODY_MAX, TITLE_MAX, validateNote } from './validation';

describe('validateNote', () => {
  it('accepts a valid note', () => {
    expect(validateNote({ title: 'Hello', body: '' })).toEqual({});
  });

  it('requires a non-blank title', () => {
    expect(validateNote({ title: '   ', body: '' }).title).toBeDefined();
  });

  it('enforces the server limits', () => {
    const errors = validateNote({ title: 'x'.repeat(TITLE_MAX + 1), body: 'x'.repeat(BODY_MAX + 1) });
    expect(Object.keys(errors)).toEqual(['title', 'body']);
  });
});
