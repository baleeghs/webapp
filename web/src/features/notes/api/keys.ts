/**
 * Query keys, hierarchical so one call invalidates a whole branch:
 * `invalidateQueries({ queryKey: notesKeys.lists() })` refetches every page of the list.
 */
export const notesKeys = {
  all: ['notes'] as const,
  lists: () => [...notesKeys.all, 'list'] as const,
  list: (page: number) => [...notesKeys.lists(), { page }] as const,
  detail: (id: string) => [...notesKeys.all, 'detail', id] as const,
};
