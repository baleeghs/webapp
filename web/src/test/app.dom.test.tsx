import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './utils';

describe('app shell', () => {
  it('renders the overview with navigation and API status', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Online')).toBeInTheDocument();
  });

  it('collapses the sidebar to a rail and keeps link names', async () => {
    const { user } = renderApp('/');
    const sidebar = await screen.findByRole('complementary', { name: 'Sidebar' });
    await user.click(screen.getByRole('button', { name: /Collapse sidebar/ }));
    expect(sidebar).toHaveAttribute('data-collapsed');
    expect(within(sidebar).getByRole('link', { name: 'Notes' })).toHaveAttribute('title', 'Notes');
    await user.click(screen.getByRole('button', { name: /Expand sidebar/ }));
    expect(sidebar).not.toHaveAttribute('data-collapsed');
  });

  it('toggles the sidebar with Ctrl+B, but not while typing', async () => {
    // The test DOM is a 1024 px window, so the shortcut drives the desktop rail.
    const { user } = renderApp('/notes');
    const sidebar = await screen.findByRole('complementary', { name: 'Sidebar' });
    await user.keyboard('{Control>}b{/Control}');
    expect(sidebar).toHaveAttribute('data-collapsed');
    await user.keyboard('{Control>}b{/Control}');
    expect(sidebar).not.toHaveAttribute('data-collapsed');

    // In a text field Ctrl+B belongs to the field (bold), not the app.
    await user.click((await screen.findAllByRole('button', { name: 'New note' }))[0]!);
    await user.type(screen.getByLabelText('Title'), 'x{Control>}b{/Control}');
    expect(sidebar).not.toHaveAttribute('data-collapsed');
  });

  it('shows a not-found page for unknown URLs', async () => {
    renderApp('/does/not/exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('applies appearance settings to <html>', async () => {
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Dark' }));
    await user.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.dataset['density']).toBe('compact');

    await user.click(screen.getByRole('radio', { name: /Forest/ }));
    expect(document.documentElement.dataset['palette']).toBe('forest');
    expect(screen.getByRole('radio', { name: /Forest/ })).toBeChecked();
  });
});
