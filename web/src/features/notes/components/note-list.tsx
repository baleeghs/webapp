import { Link } from '@tanstack/react-router';
import { RelativeTime } from '@/components/ui';
import type { Note } from '../api/types';

export function NoteList({ notes }: { notes: readonly Note[] }) {
  return (
    <ul className="card divide-y divide-border-subtle">
      {notes.map((note) => (
        <li key={note.id}>
          <Link
            to="/notes/$noteId"
            params={{ noteId: note.id }}
            className="flex items-baseline gap-4 px-4 py-3 transition-colors hover:bg-hover focus-visible:bg-hover"
          >
            <div className="min-w-0 flex-1">
              <p className="app-truncate font-medium text-fg">{note.title}</p>
              {note.body && <p className="app-truncate text-compact-sm text-fg-muted">{note.body}</p>}
            </div>
            <RelativeTime iso={note.updatedAt} className="shrink-0 text-compact-sm text-fg-subtle" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
