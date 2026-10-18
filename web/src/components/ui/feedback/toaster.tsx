import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/cn';
import { useToastStore, type ToastTone } from './toast';

const TONE: Record<ToastTone, { icon: IconName; className: string }> = {
  info: { icon: 'INFO', className: 'text-info' },
  success: { icon: 'CHECK_CIRCLE', className: 'text-success' },
  error: { icon: 'ERROR', className: 'text-danger-text' },
};

/** Renders the toast stack. Mounted once, in app/providers.tsx. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-(--z-toast) flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="card-elevated pointer-events-auto flex animate-toast-in items-start gap-2.5 p-3"
        >
          <Icon name={TONE[t.tone].icon} size="md" className={cn('mt-px', TONE[t.tone].className)} />
          <div className="min-w-0 flex-1">
            <p className="text-compact-base font-medium text-fg">{t.title}</p>
            {t.description && <p className="mt-0.5 text-compact-sm text-fg-muted">{t.description}</p>}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="focus-ring app-hit rounded-sm text-fg-subtle hover:text-fg"
          >
            <Icon name="CLOSE" size="sm" />
          </button>
        </div>
      ))}
    </section>
  );
}
