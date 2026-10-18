import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PageBody, PageHeader } from '@/components/layout';
import { Button, ConfirmDialog, Panel, RelativeTime, toast } from '@/components/ui';
import { NoteForm, noteQuery, useDeleteNote, useUpdateNote } from '@/features/notes';

const route = getRouteApi('/notes/$noteId');

export function NotePage() {
  const { noteId } = route.useParams();
  const navigate = route.useNavigate();
  const { data: note } = useSuspenseQuery(noteQuery(noteId));
  const update = useUpdateNote(noteId);
  const remove = useDeleteNote();
  const [confirming, setConfirming] = useState(false);

  const deleteNote = () =>
    remove.mutate(noteId, {
      onSuccess: () => {
        toast.success('Note deleted');
        void navigate({ to: '/notes' });
      },
      onSettled: () => setConfirming(false),
    });

  return (
    <>
      <PageHeader
        title={note.title}
        description={
          <>
            Updated <RelativeTime iso={note.updatedAt} />
          </>
        }
        actions={
          <>
            <Link to="/notes" className="self-center text-compact-base text-fg-muted hover:text-fg">
              Back to notes
            </Link>
            <Button variant="danger" icon="TRASH" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          </>
        }
      />
      <PageBody>
        <Panel title="Edit">
          {/* Keyed by updatedAt so the form resets to the saved values after each save. */}
          <NoteForm
            key={note.updatedAt}
            initial={{ title: note.title, body: note.body }}
            submitLabel="Save changes"
            pending={update.isPending}
            error={update.error}
            onSubmit={(values) => update.mutate(values, { onSuccess: () => toast.success('Saved') })}
          />
        </Panel>
      </PageBody>
      <ConfirmDialog
        open={confirming}
        title="Delete this note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={remove.isPending}
        onConfirm={deleteNote}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
