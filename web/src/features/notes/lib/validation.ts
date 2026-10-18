/**
 * Client-side checks mirroring the server's (app-core `notes::model`), so users get instant
 * feedback. The server stays the authority: its field errors are shown too.
 */
export const TITLE_MAX = 200;
export const BODY_MAX = 10_000;

export interface NoteFormValues {
  title: string;
  body: string;
}

export type NoteFormErrors = Partial<Record<keyof NoteFormValues, string>>;

export function validateNote(values: NoteFormValues): NoteFormErrors {
  const errors: NoteFormErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = 'Enter a title.';
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;
  if (values.body.length > BODY_MAX) errors.body = `Keep the note under ${BODY_MAX.toLocaleString()} characters.`;
  return errors;
}
