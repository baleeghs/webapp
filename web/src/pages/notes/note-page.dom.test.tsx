import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeNote } from '@/test/fixtures';
import { db } from '@/test/mock-api';
import { renderApp } from '@/test/utils';

describe('note page', () => {
  it('edits a note', async () => {
    const note = makeNote({ title: 'Draft', body: 'v1' });
    db.notes = [note];
    const { user } = renderApp(`/notes/${note.id}`);

    const body = await screen.findByLabelText('Body');
    await user.clear(body);
    await user.type(body, 'v2');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(db.notes[0]?.body).toBe('v2');
  });

  it('deletes a note after confirmation and returns to the list', async () => {
    const note = makeNote({ title: 'Temporary' });
    db.notes = [note];
    const { user, router } = renderApp(`/notes/${note.id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(db.notes).toHaveLength(1);
    await user.click(
      screen.getByRole('dialog', { name: 'Delete this note?' }).querySelector('footer button:last-child')!,
    );

    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/notes');
    expect(db.notes).toHaveLength(0);
  });

  it('reports a missing note', async () => {
    renderApp('/notes/00000000-0000-7000-8000-000000000999');
    expect(await screen.findByText('This page failed to load')).toBeInTheDocument();
    expect(screen.getByText(/not found/)).toBeInTheDocument();
  });
});
