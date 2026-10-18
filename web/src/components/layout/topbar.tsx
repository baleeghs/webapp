import { IconButton } from '@/components/ui';
import { useUiStore } from '@/stores/ui-store';
import { HealthIndicator } from './health-indicator';
import { ThemeToggle } from './theme-toggle';

export function Topbar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);
  return (
    <header
      data-topbar
      className="bar-frosted sticky top-0 z-(--z-header) flex h-(--topbar-height) shrink-0 items-center gap-2 border-b border-border px-3"
    >
      {/* Below md: open the drawer. From md up: collapse to / expand from the icon rail. */}
      <IconButton
        icon="MENU"
        label="Open navigation"
        aria-expanded={sidebarOpen}
        onClick={toggleSidebar}
        className="md:hidden"
      />
      <IconButton
        icon={sidebarCollapsed ? 'SIDEBAR_OPEN' : 'SIDEBAR_CLOSE'}
        label={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        aria-expanded={!sidebarCollapsed}
        onClick={toggleSidebarCollapsed}
        className="max-md:hidden"
      />
      <div className="flex-1" />
      <HealthIndicator />
      <ThemeToggle />
    </header>
  );
}
