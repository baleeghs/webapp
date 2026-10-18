import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from '../actions/icon-button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned in the footer. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Modal dialog on the native <dialog> element: the browser provides the top layer, focus trap,
 * inert background and Escape-to-close, so there is no portal or focus-trap code to maintain.
 * Mark the control that should receive focus on open with `data-autofocus`.
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first focusable element (the Close button). Content can claim
      // initial focus instead with `data-autofocus`; React's autoFocus runs too early for this.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // Backdrop click to close; keyboard users close with Escape (native), so no key handler.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // The browser can close a dialog itself (e.g. repeated Escape without a cancel event). Report
      // that, but not our own close() after `open` became false, so onClose runs once per close.
      onClose={() => open && onClose()}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the <dialog> itself, never on its content.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cn(
        'card-elevated m-auto w-[min(32rem,calc(100vw-2rem))] animate-dialog-in p-0 text-fg backdrop:bg-overlay',
        className,
      )}
    >
      {open && (
        <div className="flex flex-col">
          <header className="flex items-start gap-3 px-5 pt-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-md font-semibold">
                {title}
              </h2>
              {description && <p className="mt-1 text-compact-base text-fg-muted">{description}</p>}
            </div>
            <IconButton icon="CLOSE" label="Close" onClick={onClose} className="-mr-2" />
          </header>
          {children && <div className="px-5 py-4">{children}</div>}
          {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
