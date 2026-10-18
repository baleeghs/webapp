/**
 * Search-param validators, one per route that has any. The router runs them on every navigation,
 * so pages read typed, defaulted values and a hand-edited URL can never crash a page: invalid
 * values fall back to the default instead of throwing.
 *
 * Plain functions (TanStack Router accepts any `(search) => typed` validator) rather than a schema
 * library: a few helpers below cover what list pages need. The parameter type is intersected with
 * `SearchSchemaInput`, which tells the router that links may omit these params (the validator
 * fills the defaults); without it, every `<Link to="/notes">` would have to pass `search`.
 */
import type { SearchSchemaInput } from '@tanstack/react-router';

/** A positive integer from a search value, or `fallback` for anything else. */
export function positiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : fallback;
}

/** One of the allowed strings, or `fallback`. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export interface NotesSearch {
  page: number;
}

export const NOTES_SEARCH_DEFAULTS: NotesSearch = { page: 1 };

/** Input: every param optional (links may omit them). Output: complete and valid. */
export function validateNotesSearch(search: { page?: number } & SearchSchemaInput): NotesSearch {
  return { page: positiveInt(search.page, NOTES_SEARCH_DEFAULTS.page) };
}
