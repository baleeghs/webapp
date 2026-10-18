import { PageBody, PageHeader } from '@/components/layout';
import { AppearanceSettings } from '@/features/appearance';

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Preferences for this app." />
      <PageBody>
        {/* Full page width, so the palette previews have room to be legible. */}
        <div className="flex w-full flex-col gap-4" data-testid="settings-form">
          <p className="text-compact-sm text-fg-muted">Saved in this browser and applied instantly.</p>
          <AppearanceSettings />
        </div>
      </PageBody>
    </>
  );
}
