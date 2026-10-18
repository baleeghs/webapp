import { Panel, RadioGroup, type RadioOption } from '@/components/ui';
import { SettingRow, SettingsGrid } from '@/features/settings';
import type { Density, Theme } from '@/lib/appearance';
import { useUiStore } from '@/stores/ui-store';
import { PalettePicker } from './palette-picker';

const THEME_OPTIONS: RadioOption<Theme>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const DENSITY_OPTIONS: RadioOption<Density>[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

/** The Appearance panel: theme, palette and density, applied instantly. */
export function AppearanceSettings() {
  const theme = useUiStore((s) => s.theme);
  const palette = useUiStore((s) => s.palette);
  const density = useUiStore((s) => s.density);
  const setTheme = useUiStore((s) => s.setTheme);
  const setPalette = useUiStore((s) => s.setPalette);
  const setDensity = useUiStore((s) => s.setDensity);

  return (
    <Panel title="Appearance">
      <SettingsGrid>
        <SettingRow label="Theme" hint="System follows your operating system's light or dark setting.">
          {(id) => <RadioGroup labelledBy={id} value={theme} options={THEME_OPTIONS} onChange={setTheme} />}
        </SettingRow>
        <SettingRow label="Density" hint="Compact fits more rows and controls on screen.">
          {(id) => <RadioGroup labelledBy={id} value={density} options={DENSITY_OPTIONS} onChange={setDensity} />}
        </SettingRow>
        <SettingRow
          wide
          label="Palette"
          hint="Every palette has a light and a dark version and meets WCAG AA contrast."
        >
          {(id) => <PalettePicker labelledBy={id} value={palette} onChange={setPalette} />}
        </SettingRow>
      </SettingsGrid>
    </Panel>
  );
}
