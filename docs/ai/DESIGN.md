# Design system

The visual language of the web app: how theming works, every token family, the palette system and
its generator, density, layout, components classes, motion, accessibility and print. It is all
CSS under `web/src/styles/`, consumed through Tailwind utilities and `@/components/ui`. How to
build components is in [FRONTEND.md](FRONTEND.md).

---

## 1. Principles

1. **Tokens, not values.** Every colour, size, radius, shadow, duration and z-index comes from a
   token. Raw hex appears only in `themes/themes.css` and `themes/palettes.gen.css`.
2. **Semantic, not literal.** Components say `bg-surface-raised`, `text-fg-muted`, `bg-accent`,
   never "white" or "blue-600", so every palette, mode and density works without branching.
3. **Dense but legible.** An enterprise data UI: compact type scale for tables and controls, a
   12 px legibility floor, tabular numbers for data.
4. **Accessible by construction.** Contrast is checked when palettes are generated; colour never
   carries meaning alone; focus is always visible; motion respects user settings.
5. **Zero runtime cost.** Theme switching is attributes on `<html>`; no CSS-in-JS, no theme context.

---

## 2. Theming

Three independent attributes on `<html>`:

| Attribute | Values | Default |
| --- | --- | --- |
| `data-theme` | `light`, `dark` (the stored `system` choice resolves to one of them) | follows OS |
| `data-palette` | 16 palettes (§3) | `stone` |
| `data-density` | `comfortable`, `compact` | `comfortable` |

Flow:

1. `public/theme-init.js` runs before first paint, reads `localStorage['app.ui'].state` and sets
   the attributes. No flash of the wrong theme.
2. `app/providers.tsx` (`AppearanceSync`) keeps them in sync with `stores/ui-store.ts` and with
   OS colour-scheme changes while the theme is `system`.
3. During a switch `data-appearance-switching` disables transitions for one frame, so the change
   is instant rather than a slow cross-fade.

CSS cascade:

```
themes/themes.css
  :root, [data-theme='light']            shared light tokens (status, severity, charts, ramps)
  [data-theme='dark']                    shared dark tokens          (screen only, not print)
  :root, [data-palette='stone']          stone light (also the fallback for unknown palettes)
  [data-theme='dark'], [data-palette='stone'][data-theme='dark']   stone dark
  [data-palette='signal'] / …[data-theme='dark']   signal, slate
themes/palettes.gen.css                  13 generated palettes, same selector pattern
tokens/tokens.css                        @theme / @theme inline: Tailwind utilities → var(--app-*)
```

Because selectors are attributes, **any element can re-scope** palette and theme for its subtree:
`<div data-palette="forest" data-theme="dark">…</div>` renders everything inside with Forest dark.
The Settings palette previews use exactly this to paint each card with the real CSS.

Dark blocks are wrapped in `@media not print`, so printing always uses light tokens.

---

## 3. Palettes

### 3.1 The sixteen palettes

| Palette | Source | Greys | Accent |
| --- | --- | --- | --- |
| Stone (default) | hand-tuned | warm | deep teal |
| Signal | hand-tuned | cool | indigo |
| Slate | hand-tuned | blue-grey | blue |
| Forest | generated | green-tinted | emerald |
| Sage | generated | soft green | muted grey-green |
| Moss | generated | olive | olive green |
| Amber | generated | warm | gold (auto-deepened for contrast) |
| Clay | generated | warm, stronger tint | terracotta |
| Ember | generated | warm | orange-red |
| Rose | generated | rosy | crimson |
| Orchid | generated | rosy | fuchsia |
| Plum | generated | mauve | violet |
| Iris | generated | violet-grey | lavender |
| Ocean | generated | cyan-grey | cyan |
| Fjord | generated | strongly blue-tinted | steel blue |
| Graphite | generated | neutral | monochrome (accent = text colour) |

The Settings page shows each as a card with a light and a dark miniature app shell; inactive
cards are dimmed (80 % preview opacity, muted name), the active and hovered/focused ones are at
full strength.

### 3.2 The palette system

All palettes share one lightness ladder (OKLCH L), measured from the hand-tuned ones:

| Role | Light L | Dark L |
| --- | --- | --- |
| `fg` | 0.22 | 0.945 |
| `fg-muted` | 0.445 | 0.81 |
| `fg-subtle` | 0.524 | 0.711 |
| `border-control` | 0.60 | 0.576 |
| `border-strong` | 0.79 | 0.415 |
| `border` | 0.865 | 0.335 |
| `border-subtle` | 0.90 | 0.294 |
| `muted` | 0.931 | 0.281 |
| `surface-sunken` | 0.952 | 0.16 |
| `bg` | 0.973 | 0.184 |
| `surface` | 0.986 | 0.20 |
| `surface-raised` | 1.0 (white) | 0.228 |
| `accent` | ≈ 0.535 | ≈ 0.715 |

Greys take the palette's hue with chroma = `tint × curve(L)`: most tinted in mid tones, nearly
neutral at the extremes. The accent ramp derives hover (darker in light, lighter in dark),
soft background, border, on-accent text, focus ring and selection colours.

### 3.3 Adding a palette

Add one line to `PALETTES` in `web/gen/palettes.mts`:

```ts
{ name: 'forest', label: 'Forest', neutral: { hue: 150, tint: 0.014 }, accent: { hue: 152, chroma: 0.15 } },
```

| Field | Meaning | Typical range |
| --- | --- | --- |
| `neutral.hue` | OKLCH hue of the greys (0–360) | usually near the accent hue |
| `neutral.tint` | grey chroma at body-text lightness | 0 (pure grey) – 0.026 (strongly tinted) |
| `accent.hue` | brand hue | 0–360 |
| `accent.chroma` | brand saturation | 0.07 (muted) – 0.21 (vivid); clipped to sRGB |
| `mono` | accent is the text colour | Graphite |

Then `make gen-palettes` (or `cd web && pnpm gen:palettes`). The generator:

- writes `src/styles/themes/palettes.gen.css` and `src/lib/palettes.gen.ts` (names and labels,
  merged into `PALETTES` in `lib/appearance.ts`);
- **checks WCAG 2.2 contrast** for every palette and mode and fails on any miss:

  | Pair | Minimum |
  | --- | --- |
  | `fg` on `bg` | 7:1 (AAA body text) |
  | `fg-muted` on `surface-raised`, `fg-subtle` on `bg` | 4.5:1 |
  | `accent-text` on `surface-raised` and on `accent-soft` | 4.5:1 |
  | `accent-fg` on `accent` (button text) | 4.5:1 |
  | `border-control` on `surface-raised`, `ring` on `bg` | 3:1 (non-text UI) |

- darkens (light mode) or lightens (dark mode) an accent until text on it passes, so warm hues
  such as amber or orange work;
- checks the token set equals the hand-tuned `signal` block, so no palette can miss a token.

The new palette appears in Settings with its preview. `pnpm check:palettes` (CI) and
`styles/palettes.test.ts` keep the CSS, the list and the generator in sync. Hand-tuned palettes
stay in `themes.css`; add one there only if the generator cannot express it, then add its name to
`PALETTES` in `lib/appearance.ts`.

---

## 4. Colour roles

Use these Tailwind names (`bg-*`, `text-*`, `border-*`, `ring-*`, `fill-*`…):

| Group | Tokens | Use |
| --- | --- | --- |
| Canvas | `bg`, `surface`, `surface-raised`, `surface-sunken`, `surface-overlay`, `surface-elevated`, `muted`, `input` | page background → cards → popovers; `muted` for subtle fills |
| Text | `fg`, `fg-muted`, `fg-subtle`, `fg-disabled`, `fg-inverse` | primary, secondary, tertiary, disabled, on dark |
| Lines | `border-subtle`, `border`, `border-strong`, `border-control`, `border-hover` | separators → card edges → control outlines |
| Interaction | `hover`, `active`, `selection`, `ring`, `overlay` | translucent state layers, focus, scrims |
| Accent | `accent`, `accent-hover`, `accent-fg`, `accent-soft`, `accent-text`, `accent-border` | primary actions, active nav, links |
| Status | `success*`, `warning*`, `danger*` (`danger-fg`, `danger-text`, `-soft`), `info*` | feedback; `-soft` = tinted background |
| Data states | `state-{good,bad,error,degraded,flapping,stale,unknown}{,-fg,-soft,-border}` | monitoring-style status |
| Severity | `sev-{critical,high,medium,low,unspecified}{,-fg,-soft,-border}` | incident severity |
| Charts | `chart-1…8` (categorical), `seq-*` (sequential), `div-1…9` (diverging), `chart-grid`, `chart-axis`, `chart-other` | data visualisation |
| Misc | `tooltip-bg`, `tooltip-fg`, `glass`, `glass-border` | |

Naming: plain = fill, `-fg` = text on that fill, `-text` = text on the page, `-soft` = tinted
background, `-border` = outline. Pair status colour with a label or icon, always.

---

## 5. Typography

| Token | Size | Use |
| --- | --- | --- |
| `text-2xs` | 11 px | rare, never for essential info |
| `text-xs` | 12 px | captions |
| `text-sm` | 13 px | tables, filters, menus |
| `text-base` | 14 px | body (the default) |
| `text-md` | 16 px | emphasised headings in panels and dialogs |
| `text-lg` / `text-xl` / `text-2xl` | 18 / 22 / 28 px | larger headings |
| `text-compact-xs` / `-sm` | 12 px | dense metadata, hints, badges |
| `text-compact-base` | 13 px | dense UI: controls, nav, tables, form text |
| `.text-display-xs` / `-sm` / `-md` | 20 / 30 / 36 px, Space Grotesk 600 | page titles (`PageHeader` uses `-sm`) |

Fonts (self-hosted, `pnpm gen:fonts`): **Inter** for UI (with legibility features: open digits,
distinct `Il1`), **Space Grotesk** for display headings, **JetBrains Mono** for code and ids.
Use `tabular-nums` (or `.tabular`) for numbers in tables and counters.

---

## 6. Density

`data-density` switches every size that should shrink in compact mode. Tailwind's spacing unit
itself follows density (`--spacing: var(--app-density-space)`, 4 px → 3.5 px), so `p-3`, `gap-2`
etc. adapt automatically.

| Token | Comfortable | Compact | Used by |
| --- | --- | --- | --- |
| `--app-density-control-h` (`-sm`, `-xs`) | 36 (32, 24) | 30 (28, 22) | buttons, inputs |
| `--app-density-row-h` / `-head-h` | 40 / 36 | 32 / 30 | `.table-enterprise` |
| `--app-density-grid-row-h` / `-grid-head-h` | 32 / 32 | 26 / 28 | `.table-analytical` |
| `--app-density-topbar-h` | 48 | 40 | top bar |
| `--app-density-sidebar-w` / `-collapsed-w` | 224 / 56 | 208 / 48 | sidebar, icon rail |
| `--app-density-nav-item-h` | 36 | 30 | sidebar links |
| `--app-density-page-px` / `-page-pt` | 20 / 12 | 16 / 10 | page gutters |
| `--app-section-gap` | 32 | 24 | between page sections |
| `--app-density-card-p` / `-card-header-h` | 12 / 40 | 8 / 32 | `.card-*` |
| `--app-density-badge-h` / `-badge-px` | 20 / 8 | 18 / 6 | `Badge` |
| `--app-density-tab-h`, `-segment-h` | 36, 26 | 30, 22 | tabs, segmented controls |
| `--app-icon-xs…2xl` | 12/16/20/24/28/32 | sm–xl one step smaller | `Icon size` |

Use them with Tailwind's variable syntax: `h-(--app-density-control-h)`, `w-(--sidebar-width)`.
Components never branch on density in TypeScript.

---

## 7. Shape, elevation, layers, motion

**Radius**: `rounded-xs` 2 px (cards, fields), `rounded-sm` 4 px, `rounded-md` 6 px (buttons,
previews), `rounded-lg` 8, `rounded-xl` 12, `rounded-chip` (= sm) for badges and chips. Badges are
rounded squares, never pills.

**Shadows**: `shadow-xs`, `shadow-sm`, `shadow-card` (ring + soft drop), `shadow-md…2xl`,
`shadow-popover`, `shadow-overlay`. Per palette in light mode (tinted with the palette's ink),
fixed black in dark mode.

**Layers**: only the `--z-*` scale; `styles/z-index.test.ts` fails on literal z-index values.

| Token | Value | For |
| --- | --- | --- |
| `--z-base` | 0 | |
| `--z-raised` | 1 | sticky cells, hover toolbars inside a component |
| `--z-sticky` | 10 | sticky table headers |
| `--z-sidebar` | 20 | sidebar (desktop) |
| `--z-header` | 30 | top bar, sticky toolbars |
| `--z-overlay` | 40 | scrims |
| `--z-drawer` | 50 | mobile sidebar, drawers |
| `--z-popover` | 60 | menus, popovers |
| `--z-omnibox` | 70 | global search |
| `--z-toast` | 80 | toasts, navigation progress |
| `--z-tooltip` | 90 | tooltips, skip link |

Use as `z-(--z-popover)`. Native `<dialog>` sits in the browser's top layer above all of these.

**Motion**: durations `--duration-fast` 150 ms (hover, focus), `--duration-base` 200 ms,
`--duration-slow` 250 ms (surfaces); easings `--ease-standard`, `--ease-out`, `--ease-in`,
`--ease-in-out`, `--ease-spring`; animations `animate-fade-in`, `-menu-in`, `-dialog-in`,
`-toast-in`, `-slide-up`, `-shimmer`, `-spin`. Under `prefers-reduced-motion` durations become 0.

---

## 8. Layout

- **Breakpoints** (viewport, Tailwind defaults): `sm` 40rem, `md` 48rem (sidebar becomes
  persistent), `lg` 64rem, `xl` 80rem, `2xl` 96rem.
- **Container queries**: `PageBody`, the palette picker and each preview are containers; use
  `@md:` (28rem), `@xl:` (36rem), `@3xl:` (48rem) etc. so components respond to **their** width.
  Prefer container variants for anything inside a page.
- **Width**: `.app-chrome` caps page chrome at `--app-content-max` (3840 px) on ultrawide screens;
  `.app-form` (45rem) for forms that read best narrow; `.app-reading` (75ch) for prose.
- **Rhythm**: sections of a page are `--app-section-gap` apart (`PageBody`, `.app-sections`);
  blocks inside a section `gap-3`/`gap-4`.
- **Shell**: sidebar (full or icon rail from `md`, drawer below), sticky frosted top bar
  (`.bar-frosted`), scrolling `<main>`. No horizontal page scroll at any width
  (`e2e/layout.spec.ts` checks 390 → 2560 px).

---

## 9. Component classes

Shared classes in `styles/components/` for patterns used beyond a single React component:

| Class | File | Purpose |
| --- | --- | --- |
| `.card`, `.card-header`, `.card-body`, `.card-footer`, `.card-elevated`, `.card-hover` | components.css | panels (`Panel` uses them) |
| `.glass` | components.css | frosted floating chrome |
| `.section-label` | components.css | small uppercase section titles |
| `.app-skeleton` | components.css | shimmer placeholder, invisible for the first 150 ms |
| `.status-dot`, `.status-dot-pulse` | components.css | live status (colour via `text-*`) |
| `.focus-ring`, `.interactive` | components.css | focus ring for custom controls; hover lift |
| `.app-truncate`, `.app-hit` | components.css | single-line ellipsis; 24 px minimum hit area |
| `.app-tex-*` | components.css | textures for "no data" states (WCAG 1.4.1) |
| `.nav-item`, `.sidebar-section-label`, `.bar-frosted` | layout.css | navigation |
| `.app-chrome`, `.app-chrome-bar`, `.app-sections`, `.app-form`, `.app-reading` | layout.css | page structure |
| `.tabs-compact` / `.tab-compact` | enterprise.css | segmented controls (`RadioGroup`) |
| `.tabs-line` / `.tab-line` | enterprise.css | underline tabs with overflow fade |
| `.table-enterprise` | enterprise.css | dense data tables |
| `.table-analytical`, `.app-row-actions`, `.app-col-resize` | enterprise.css | sticky header + first column, hover/selection, resizable columns |
| `.app-logo-*` | brand.css | logo fills and intro/loading animations |
| `.text-display-*`, `.font-display`, `.tabular` | components.css, base.css | display type, tabular figures |

Prefer a React component in `components/ui` for anything with behaviour; add a class here only
for a styling pattern several components share.

---

## 10. Icons and logo

- Icons: Material Symbols (Rounded, Outlined fallback) as inline SVG paths in
  `components/icons/svg.ts`, rendered by `<Icon name="PLUS" size="sm" />` (`filled` for the
  filled variant; `label` makes it an image with an accessible name, otherwise it is hidden).
  Add icons via `ICON_MAP` in `web/gen/icons.mts` + `pnpm gen:icons`.
- Logo: `components/brand/logo.tsx` (three bars; the tallest uses `--app-logo-alert`), name from
  `APP_NAME`. Replace both when branding a derived project; favicon in `public/favicon.svg`.

---

## 11. Accessibility checklist

- Text contrast ≥ 4.5:1 (body ≥ 7:1), UI boundaries and focus ≥ 3:1: enforced for palettes.
- Visible focus on every interactive element (`:focus-visible` outline, `.focus-ring`,
  `has-focus-visible:ring-*` for labels around hidden inputs).
- Hit areas ≥ 24 px (`.app-hit` for small icon buttons).
- State never by colour alone (labels, icons, textures).
- Dimmed or disabled content keeps readable text; dim imagery, not words.
- Motion is optional (`prefers-reduced-motion`).

---

## 12. Print

`styles/components/print.css`: pages print as documents on A4. App chrome (sidebar, top bar,
toolbars, breadcrumbs, `[data-print-hide]`, `.print-hidden`, page actions, notifications) is
hidden; tables, figures and charts avoid page breaks (`[data-print-keep]` for others); table
headers repeat; colours print as shown; light tokens are always used.

---

## 13. Do and don't

| Do | Don't |
| --- | --- |
| `bg-surface-raised text-fg border-border` | `bg-white text-black border-gray-200` |
| `z-(--z-popover)` | `z-50`, `z-[999]` |
| `h-(--app-density-control-h)` | `h-9` for a control |
| `text-compact-base` in dense UI | arbitrary `text-[13px]` |
| `cn('base', condition && 'extra', className)` | string concatenation of classes |
| a palette line in `gen/palettes.mts` | hand-picked hex values in a new CSS file |
| `data-palette` / `data-theme` on a wrapper to preview | duplicating colours in TypeScript |
