import { useEffect, type ReactNode } from 'react';
import { useUiStore } from '@/stores/ui-store';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/** Ctrl+B / ⌘B toggles the sidebar: the rail on wide screens, the drawer on narrow ones. */
function useSidebarShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'b' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      // Leave the shortcut to the text field (bold) when typing.
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      const { toggleSidebar, toggleSidebarCollapsed } = useUiStore.getState();
      if (matchMedia('(min-width: 48rem)').matches) toggleSidebarCollapsed();
      else toggleSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * The frame around every page: sidebar, top bar and the scrolling main area. From `md` up the
 * sidebar can collapse to an icon rail (remembered); below `md` it is a drawer over a scrim.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const close = () => setSidebarOpen(false);
  useSidebarShortcut();

  return (
    <div className="flex h-full">
      <a
        href="#main"
        className="sr-only z-(--z-tooltip) rounded-md bg-surface-raised px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar open={sidebarOpen} collapsed={sidebarCollapsed} onNavigate={close} />
      {sidebarOpen && (
        <div aria-hidden className="fixed inset-0 z-(--z-overlay) bg-overlay md:hidden" onClick={close} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
