import { useRouterState } from '@tanstack/react-router';

/**
 * A thin bar at the top while a navigation waits for loaders. It fades in after a delay (CSS), so
 * fast navigations never flash it.
 */
export function NavigationProgress() {
  const pending = useRouterState({ select: (s) => s.status === 'pending' });
  if (!pending) return null;
  return (
    <div
      // Decorative: RoutePending carries the screen-reader text for slow loads.
      aria-hidden
      className="fixed inset-x-0 top-0 z-(--z-toast) h-0.5 [animation:fade-in_var(--duration-base)_var(--ease-standard)_150ms_both] bg-accent"
    />
  );
}
