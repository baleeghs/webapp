/// <reference types="node" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTES } from '@/lib/appearance';

/** Every palette offered in Settings must exist in CSS, for light and dark. */
const css = ['themes/themes.css', 'themes/palettes.gen.css']
  .map((f) => readFileSync(path.resolve(import.meta.dirname, f), 'utf8'))
  .join('\n');

describe('palettes', () => {
  it.each(PALETTES.map((p) => p.name))('%s has light and dark tokens', (name) => {
    expect(css).toContain(`[data-palette='${name}'] {`);
    expect(css).toMatch(new RegExp(`\\[data-palette='${name}'\\]\\[data-theme='dark'\\] \\{`));
  });

  it('has unique names', () => {
    const names = PALETTES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
