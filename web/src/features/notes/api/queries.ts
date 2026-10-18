import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import { notesKeys } from './keys';
import type { CreateNoteInput, UpdateNoteInput } from './types';

export const NOTES_PAGE_SIZE = 20;

/** One page of notes (1-based). Used by the route loader and the page, so they share a cache entry. */
export function notesListQuery(page: number) {
  return queryOptions({
    queryKey: notesKeys.list(page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/api/v1/notes', {
          params: { query: { limit: NOTES_PAGE_SIZE, offset: (page - 1) * NOTES_PAGE_SIZE } },
          signal,
        }),
      ),
  });
}

export function noteQuery(id: string) {
  return queryOptions({
    queryKey: notesKeys.detail(id),
    queryFn: ({ signal }) => unwrap(api.GET('/api/v1/notes/{id}', { params: { path: { id } }, signal })),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNoteInput) => unwrap(api.POST('/api/v1/notes', { body })),
    meta: { toastOnError: false },
    onSuccess: async (note) => {
      queryClient.setQueryData(notesKeys.detail(note.id), note);
      await queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
    },
  });
}

export function useUpdateNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNoteInput) => unwrap(api.PATCH('/api/v1/notes/{id}', { params: { path: { id } }, body })),
    meta: { toastOnError: false },
    onSuccess: async (note) => {
      queryClient.setQueryData(notesKeys.detail(id), note);
      await queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/v1/notes/{id}', { params: { path: { id } } })),
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: notesKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
    },
  });
}
