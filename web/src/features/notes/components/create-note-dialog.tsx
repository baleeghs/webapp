import { Dialog, toast } from '@/components/ui';
import { useCreateNote } from '../api/queries';
import { NoteForm } from './note-form';

export function CreateNoteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateNote();
  const close = () => {
    create.reset();
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} title="New note">
      <NoteForm
        focusTitle
        submitLabel="Create note"
        pending={create.isPending}
        error={create.error}
        onCancel={close}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (note) => {
              toast.success('Note created', note.title);
              close();
            },
          })
        }
      />
    </Dialog>
  );
}
