import { Link, type LinkProps } from '@tanstack/react-router';
import { Logo } from '@/components/brand';
import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/cn';

interface NavItem {
  to: NonNullable<LinkProps['to']>;
  label: string;
  icon: IconName;
  exact?: boolean;
}

/** Primary navigation. Add an entry per top-level page. */
const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: 'HOME', exact: true },
  { to: '/notes', label: 'Notes', icon: 'NOTE' },
];

const FOOTER_NAV: NavItem[] = [{ to: '/settings', label: 'Settings', icon: 'SETTINGS' }];

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      activeProps={{ 'aria-current': 'page' }}
      // In the rail the label is hidden, so the native tooltip names the destination.
      title={collapsed ? item.label : undefined}
      className={cn('nav-item', collapsed && 'md:justify-center md:px-0')}
      onClick={onNavigate}
    >
      <Icon name={item.icon} size="md" />
      {/* Visually hidden in the rail, still the link's accessible name. */}
      <span className={cn(collapsed && 'md:sr-only')}>{item.label}</span>
    </Link>
  );
}

export interface SidebarProps {
  /** Drawer state below `md`. */
  open: boolean;
  /** Icon-only rail from `md` up. */
  collapsed: boolean;
  onNavigate: () => void;
}

export function Sidebar({ open, collapsed, onNavigate }: SidebarProps) {
  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed || undefined}
      className={cn(
        'fixed inset-y-0 left-0 z-(--z-drawer) flex w-(--sidebar-width) flex-col border-r border-border bg-surface',
        'transition-[translate,width] duration-(--duration-slow) md:static md:z-(--z-sidebar) md:translate-x-0',
        open ? 'translate-x-0 shadow-xl md:shadow-none' : '-translate-x-full',
        collapsed && 'md:w-(--sidebar-collapsed-width)',
      )}
    >
      <div
        className={cn('flex h-(--topbar-height) shrink-0 items-center px-4', collapsed && 'md:justify-center md:px-0')}
      >
        <Link to="/" onClick={onNavigate} className="rounded-sm">
          <Logo animation="intro" className={cn(collapsed && 'md:[&_.app-logo-text]:sr-only')} />
        </Link>
      </div>
      <nav
        aria-label="Main"
        className="flex flex-1 flex-col gap-(--app-density-nav-gap) overflow-x-hidden overflow-y-auto px-2 py-2"
      >
        {MAIN_NAV.map((item) => (
          <NavLink key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
      <nav
        aria-label="Secondary"
        className="flex flex-col gap-(--app-density-nav-gap) border-t border-border px-2 py-2"
      >
        {FOOTER_NAV.map((item) => (
          <NavLink key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
    </aside>
  );
}
