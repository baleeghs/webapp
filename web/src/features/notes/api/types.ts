import type { Schema } from '@/lib/api/types';

export type Note = Schema<'NoteDto'>;
export type NotePage = Schema<'NotePage'>;
export type CreateNoteInput = Schema<'CreateNoteRequest'>;
export type UpdateNoteInput = Schema<'UpdateNoteRequest'>;
