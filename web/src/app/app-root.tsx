import { Outlet } from '@tanstack/react-router';
import { AppShell } from '@/components/layout';
import { NavigationProgress } from './navigation-progress';

/** The root route's component: the shell around every page. */
export function AppRoot() {
  return (
    <>
      <NavigationProgress />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  );
}
