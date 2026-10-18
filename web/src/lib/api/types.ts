import type { components } from './schema.gen';

/**
 * A schema from the server's OpenAPI document, e.g. `Schema<'NoteDto'>`. Features alias the ones
 * they use in their own `api/types.ts`; never hand-write a type the server already describes.
 */
export type Schema<K extends keyof components['schemas']> = components['schemas'][K];

export type ErrorBody = Schema<'ErrorBody'>;
export type FieldError = Schema<'FieldErrorDto'>;
