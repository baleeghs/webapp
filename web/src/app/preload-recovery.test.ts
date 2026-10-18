import { describe, expect, it } from 'vitest';
import { shouldReload } from './preload-recovery';

describe('shouldReload', () => {
  it('reloads the first time', () => {
    expect(shouldReload(null, 1_000)).toBe(true);
  });

  it('does not reload again right away (broken chunk, not a deploy)', () => {
    expect(shouldReload(1_000, 5_000)).toBe(false);
  });

  it('reloads again after a while (another deploy)', () => {
    expect(shouldReload(1_000, 60_000)).toBe(true);
  });
});
