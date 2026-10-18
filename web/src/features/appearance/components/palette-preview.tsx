import { Logo } from '@/components/brand';
import type { Palette } from '@/lib/appearance';

/**
 * A miniature app shell (sidebar, panel, text lines, accent button) in one palette and mode. The
 * attributes on the wrapper re-scope the design tokens, so it is painted by the real palette CSS.
 * Its contents are sized in container units (`cqw`), so the preview keeps its proportions and stays
 * crisp at whatever width the card gets.
 */
function Mini({ palette, mode }: { palette: Palette; mode: 'light' | 'dark' }) {
  return (
    <span
      data-palette={palette}
      data-theme={mode}
      className="@container flex aspect-[6/5] flex-1 overflow-hidden rounded-md border border-border bg-bg"
    >
      <span className="flex w-[24cqw] flex-col items-center gap-[5cqw] border-r border-border bg-surface pt-[6cqw]">
        <Logo withName={false} markClassName="size-[13cqw]" />
        <span className="h-[4cqw] w-[11cqw] rounded-full bg-accent" />
        <span className="h-[4cqw] w-[11cqw] rounded-full bg-border-strong" />
      </span>
      <span className="flex flex-1 flex-col p-[6cqw]">
        <span className="flex flex-1 flex-col gap-[4cqw] rounded-[3cqw] bg-surface-raised p-[5cqw] shadow-card">
          <span className="h-[4cqw] w-3/4 rounded-full bg-fg" />
          <span className="h-[4cqw] w-1/2 rounded-full bg-fg-subtle" />
          <span className="mt-auto h-[6cqw] w-1/3 rounded-full bg-accent" />
        </span>
      </span>
    </span>
  );
}

/** Light and dark minis side by side. Decorative: the surrounding card carries the name. */
export function PalettePreview({ palette }: { palette: Palette }) {
  return (
    <span aria-hidden className="flex gap-1.5">
      <Mini palette={palette} mode="light" />
      <Mini palette={palette} mode="dark" />
    </span>
  );
}
