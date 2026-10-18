import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeNote } from '@/test/fixtures';
import { db, json, route, server } from '@/test/mock-api';
import { renderApp } from '@/test/utils';

describe('notes page', () => {
  it('lists notes newest first', async () => {
    db.notes = [makeNote({ title: 'Older' }), makeNote({ title: 'Newer' })];
    renderApp('/notes');
    const items = await screen.findAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Newer'),
      expect.stringContaining('Older'),
    ]);
  });

  it('shows an empty state', async () => {
    renderApp('/notes');
    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
  });

  it('creates a note', async () => {
    const { user } = renderApp('/notes');
    await user.click((await screen.findAllByRole('button', { name: 'New note' }))[0]!);
    const dialog = screen.getByRole('dialog', { name: 'New note' });
    await user.type(within(dialog).getByLabelText('Title'), 'Groceries');
    await user.click(within(dialog).getByRole('button', { name: 'Create note' }));

    expect(await screen.findByRole('link', { name: /Groceries/ })).toBeInTheDocument();
    expect(screen.getByText('Note created')).toBeInTheDocument();
    expect(db.notes).toHaveLength(1);
  });

  it('validates on the client before calling the API', async () => {
    const { user } = renderApp('/notes');
    await user.click((await screen.findAllByRole('button', { name: 'New note' }))[0]!);
    await user.click(screen.getByRole('button', { name: 'Create note' }));
    expect(screen.getByText('Enter a title.')).toBeInTheDocument();
    expect(db.notes).toHaveLength(0);
  });

  it('shows server field errors under the field', async () => {
    server.use(
      route('POST', '/api/v1/notes', () =>
        json(
          {
            error: {
              code: 'validation_failed',
              message: 'validation failed',
              details: [{ field: 'title', message: 'already taken' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const { user } = renderApp('/notes');
    await user.click((await screen.findAllByRole('button', { name: 'New note' }))[0]!);
    await user.type(screen.getByLabelText('Title'), 'Dup');
    await user.click(screen.getByRole('button', { name: 'Create note' }));
    expect(await screen.findByText('already taken')).toBeInTheDocument();
  });

  it('pages through notes with the URL', async () => {
    db.notes = Array.from({ length: 25 }, (_, i) => makeNote({ title: `N${i}` }));
    const { user, router } = renderApp('/notes');
    expect(await screen.findByText('1–20 of 25')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('21–25 of 25')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ page: 2 });
  });

  it('shows a retryable error when loading fails', async () => {
    server.use(
      route('GET', '/api/v1/notes', () =>
        json({ error: { code: 'unavailable', message: 'service unavailable: database' } }, { status: 503 }),
      ),
    );
    renderApp('/notes');
    expect(await screen.findByText('This page failed to load')).toBeInTheDocument();
    expect(screen.getByText('service unavailable: database')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
