import type { Note } from '@/features/notes';

let seq = 0;

/** A note as the API returns it. Ids sort by creation, like the server's UUIDv7s. */
export function makeNote(overrides: Partial<Note> = {}): Note {
  seq += 1;
  const at = new Date(Date.UTC(2026, 9, 1, 12, 0, seq)).toISOString();
  return {
    id: `00000000-0000-7000-8000-${String(seq).padStart(12, '0')}`,
    title: `Note ${seq}`,
    body: '',
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}
