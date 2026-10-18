import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { PageBody, PageHeader } from '@/components/layout';
import { Button, EmptyState, Pagination } from '@/components/ui';
import { CreateNoteDialog, NOTES_PAGE_SIZE, NoteList, notesListQuery } from '@/features/notes';

const route = getRouteApi('/notes');

export function NotesPage() {
  const { page } = route.useSearch();
  const navigate = route.useNavigate();
  const { data } = useSuspenseQuery(notesListQuery(page));
  const [creating, setCreating] = useState(false);

  const newNote = (
    <Button variant="primary" icon="PLUS" onClick={() => setCreating(true)}>
      New note
    </Button>
  );

  return (
    <>
      <PageHeader title="Notes" description="The example CRUD feature. Copy it to build your own." actions={newNote} />
      <PageBody>
        {data.items.length === 0 ? (
          <EmptyState
            icon="NOTE"
            title={page > 1 ? 'No notes on this page' : 'No notes yet'}
            description="Notes you create appear here."
            action={newNote}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <NoteList notes={data.items} />
            <Pagination
              page={page}
              pageSize={NOTES_PAGE_SIZE}
              total={data.total}
              onPageChange={(next) => void navigate({ search: { page: next } })}
            />
          </div>
        )}
      </PageBody>
      <CreateNoteDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
