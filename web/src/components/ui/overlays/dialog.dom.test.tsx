import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      title="Rename"
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    >
      <input aria-label="Name" data-autofocus />
    </Dialog>
  );
}

describe('Dialog', () => {
  it('is labelled by its title and focuses the data-autofocus field', () => {
    render(<Harness onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('reports a close exactly once, whichever way it closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn<() => void>();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('reports a close the browser made on its own', () => {
    const onClose = vi.fn<() => void>();
    render(<Harness onClose={onClose} />);
    (screen.getByRole('dialog') as HTMLDialogElement).close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
