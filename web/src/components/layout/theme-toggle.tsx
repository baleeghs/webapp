import { IconButton } from '@/components/ui';
import { resolveTheme } from '@/lib/appearance';
import { usePrefersDark } from '@/lib/use-prefers-dark';
import { useUiStore } from '@/stores/ui-store';

/** Flips between light and dark. The full choice (incl. "system") is on the Settings page. */
export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const prefersDark = usePrefersDark();
  const isDark = resolveTheme(theme, prefersDark) === 'dark';
  return (
    <IconButton
      icon={isDark ? 'SUN' : 'MOON'}
      label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    />
  );
}
