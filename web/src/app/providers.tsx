import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Toaster } from '@/components/ui';
import { applyAppearance } from '@/lib/appearance';
import { useUiStore } from '@/stores/ui-store';

/** Keeps <html data-theme/palette/density> in sync with the store and the OS colour scheme. */
function AppearanceSync() {
  const theme = useUiStore((s) => s.theme);
  const palette = useUiStore((s) => s.palette);
  const density = useUiStore((s) => s.density);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => applyAppearance(document.documentElement, { theme, palette, density }, media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, palette, density]);

  return null;
}

/** App-wide providers. The router is rendered inside, so routes can use everything here. */
export function AppProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceSync />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
