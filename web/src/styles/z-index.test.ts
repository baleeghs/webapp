/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Stacking order comes only from the --z-* scale in tokens/tokens.css (docs/ai/DESIGN.md
 * "Layers"). A literal z-index anywhere else eventually puts a menu under a header.
 */
const SRC = path.resolve(import.meta.dirname, '..');
const TOKENS = path.join(SRC, 'styles/tokens/tokens.css');

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(css|tsx?)$/.test(f) && !f.includes('.test.'))
    .map((f) => path.join(dir, f));
}

describe('z-index', () => {
  it('uses only the token scale', () => {
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      if (file === TOKENS) continue;
      const text = readFileSync(file, 'utf8');
      const literal = file.endsWith('.css') ? /z-index:\s*-?\d/g : /\bz-(\d+|\[\d+\])(?![\w-])/g;
      for (const match of text.matchAll(literal)) offenders.push(`${path.relative(SRC, file)}: ${match[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});
