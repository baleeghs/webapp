/**
 * `pnpm gen:palettes`: writes src/styles/themes/palettes.gen.css and src/lib/palettes.gen.ts from
 * the PALETTES list below. `pnpm check:palettes` (CI) fails when either output is stale.
 *
 * The hand-tuned palettes in themes.css (stone, signal, slate) share one system: every neutral
 * token has a fixed OKLCH lightness, tinted by a hue with a small chroma, and the accent sits at a
 * fixed lightness per mode. This script applies that system, so a new palette is four numbers:
 *
 *   neutral.hue / neutral.tint   hue and chroma of the greys (tint = chroma at body-text level)
 *   accent.hue  / accent.chroma  the brand colour
 *
 * Every palette is checked against WCAG 2.2 contrast (text 4.5:1, UI 3:1, body text 7:1); an
 * accent too light for white text is darkened until it passes, and an impossible palette fails
 * the script. The token list is checked against the `signal` block in themes.css, so a palette can
 * never miss a token the app uses.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface PaletteDef {
  name: string;
  label: string;
  neutral: { hue: number; tint: number };
  accent: { hue: number; chroma: number };
  /** Monochrome: the accent is the text colour itself (near black / near white). */
  mono?: boolean;
}

/** Add a palette here, run `pnpm gen:palettes`, and it appears in Settings. */
const PALETTES: PaletteDef[] = [
  // Ordered around the colour wheel, so the Settings grid reads as a gradient.
  { name: 'forest', label: 'Forest', neutral: { hue: 150, tint: 0.014 }, accent: { hue: 152, chroma: 0.15 } },
  { name: 'sage', label: 'Sage', neutral: { hue: 140, tint: 0.01 }, accent: { hue: 140, chroma: 0.07 } },
  { name: 'moss', label: 'Moss', neutral: { hue: 115, tint: 0.012 }, accent: { hue: 125, chroma: 0.14 } },
  { name: 'amber', label: 'Amber', neutral: { hue: 75, tint: 0.014 }, accent: { hue: 72, chroma: 0.16 } },
  { name: 'clay', label: 'Clay', neutral: { hue: 55, tint: 0.016 }, accent: { hue: 45, chroma: 0.11 } },
  { name: 'ember', label: 'Ember', neutral: { hue: 55, tint: 0.012 }, accent: { hue: 38, chroma: 0.19 } },
  { name: 'rose', label: 'Rose', neutral: { hue: 5, tint: 0.012 }, accent: { hue: 8, chroma: 0.2 } },
  { name: 'orchid', label: 'Orchid', neutral: { hue: 345, tint: 0.012 }, accent: { hue: 345, chroma: 0.2 } },
  { name: 'plum', label: 'Plum', neutral: { hue: 315, tint: 0.014 }, accent: { hue: 310, chroma: 0.18 } },
  { name: 'iris', label: 'Iris', neutral: { hue: 290, tint: 0.014 }, accent: { hue: 290, chroma: 0.17 } },
  { name: 'ocean', label: 'Ocean', neutral: { hue: 215, tint: 0.016 }, accent: { hue: 222, chroma: 0.13 } },
  { name: 'fjord', label: 'Fjord', neutral: { hue: 235, tint: 0.026 }, accent: { hue: 230, chroma: 0.09 } },
  {
    name: 'graphite',
    label: 'Graphite',
    neutral: { hue: 260, tint: 0.004 },
    accent: { hue: 260, chroma: 0 },
    mono: true,
  },
];

// ── Colour maths (OKLCH ⇄ sRGB, WCAG contrast) ───────────────────────────────

type Rgb = [number, number, number]; // 0..1, gamma-encoded

function oklchToLinear(L: number, C: number, H: number): Rgb {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const encode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const inGamut = (rgb: Rgb) => rgb.every((x) => x >= -1e-4 && x <= 1 + 1e-4);

class Color {
  readonly L: number;
  readonly C: number;
  readonly H: number;
  /** Set for colours parsed from hex, whose sRGB value is exact. */
  private readonly fixed: Rgb | undefined;

  constructor(L: number, C: number, H: number, fixed?: Rgb) {
    this.L = L;
    this.C = C;
    this.H = H;
    this.fixed = fixed;
  }

  static fromHex(hex: string): Color | undefined {
    if (!/^#[0-9a-f]{6}$/.test(hex)) return undefined;
    return new Color(0, 0, 0, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb);
  }

  /** sRGB, reducing chroma (never lightness or hue) until the colour fits the gamut. */
  get rgb(): Rgb {
    if (this.fixed) return this.fixed;
    let lo = 0;
    let hi = this.C;
    if (!inGamut(oklchToLinear(this.L, hi, this.H))) {
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(oklchToLinear(this.L, mid, this.H))) lo = mid;
        else hi = mid;
      }
      hi = lo;
    }
    return oklchToLinear(this.L, hi, this.H).map((x) => encode(Math.min(1, Math.max(0, x)))) as Rgb;
  }

  get hex(): string {
    return `#${this.rgb
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`;
  }

  /** `rgb(r g b / alpha)` for translucent tokens. */
  alpha(a: number): string {
    const [r, g, b] = this.rgb.map((x) => Math.round(x * 255));
    return `rgb(${r} ${g} ${b} / ${a})`;
  }

  get luminance(): number {
    const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = this.rgb.map(lin) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  withL(L: number): Color {
    return new Color(L, this.C, this.H);
  }
}

function contrast(a: Color, b: Color): number {
  const [hi, lo] = [a.luminance, b.luminance].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Moves `c`'s lightness away from `against` until the contrast reaches `min`. */
function ensureContrast(c: Color, against: Color, min: number, what: string): Color {
  const step = c.L < against.L ? -0.005 : 0.005;
  let out = c;
  while (contrast(out, against) < min) {
    out = out.withL(out.L + step);
    if (out.L < 0.05 || out.L > 0.99) throw new Error(`cannot reach ${min}:1 contrast for ${what}`);
  }
  return out;
}

// ── The token system ─────────────────────────────────────────────────────────

const WHITE = new Color(1, 0, 0);

/** Neutral chroma relative to `tint`, by lightness: greys are most tinted in the mid tones. */
const TINT_CURVE: Array<[number, number]> = [
  [0.15, 0.7],
  [0.2, 1],
  [0.6, 1],
  [0.79, 0.72],
  [0.865, 0.57],
  [0.9, 0.43],
  [0.95, 0.29],
  [0.986, 0.21],
  [1, 0],
];

function tintAt(L: number): number {
  for (let i = 1; i < TINT_CURVE.length; i++) {
    const [l0, k0] = TINT_CURVE[i - 1]!;
    const [l1, k1] = TINT_CURVE[i]!;
    if (L <= l1) return k0 + ((Math.max(L, l0) - l0) / (l1 - l0)) * (k1 - k0);
  }
  return 0;
}

/** Lightness of each neutral role, measured from the hand-tuned palettes. */
const NEUTRAL_L = {
  light: {
    bg: 0.973,
    surface: 0.986,
    sunken: 0.952,
    muted: 0.931,
    chartGrid: 0.912,
    borderSubtle: 0.9,
    border: 0.865,
    borderStrong: 0.79,
    borderControl: 0.6,
    fgSubtle: 0.524,
    fgMuted: 0.445,
    fg: 0.22,
  },
  dark: {
    sunken: 0.16,
    bg: 0.184,
    surface: 0.2,
    raised: 0.228,
    overlay: 0.258,
    muted: 0.281,
    borderSubtle: 0.294,
    border: 0.335,
    borderStrong: 0.415,
    borderControl: 0.576,
    fgSubtle: 0.711,
    fgMuted: 0.81,
    fg: 0.945,
  },
} as const;

type Tokens = Array<[string, string]>;

function neutral(def: PaletteDef, L: number): Color {
  return new Color(L, def.neutral.tint * tintAt(L), def.neutral.hue);
}

function lightTokens(def: PaletteDef): Tokens {
  const n = Object.fromEntries(Object.entries(NEUTRAL_L.light).map(([k, L]) => [k, neutral(def, L)])) as Record<
    keyof typeof NEUTRAL_L.light,
    Color
  >;
  const { hue, chroma } = def.accent;
  let accent = def.mono ? neutral(def, 0.27) : new Color(0.535, chroma, hue);
  accent = ensureContrast(accent, WHITE, 4.5, `${def.name} light accent vs white text`);
  const hover = def.mono ? neutral(def, 0.37) : new Color(accent.L - 0.07, chroma * 0.93, hue);
  const soft = def.mono ? neutral(def, 0.955) : new Color(0.972, Math.min(0.014, chroma), hue);
  const accentBorder = def.mono ? n.borderStrong : new Color(0.812, Math.min(chroma * 0.55, 0.095), hue);
  const text = ensureContrast(accent, soft, 4.5, `${def.name} light accent text on soft`);
  const ink = n.fg;

  return [
    ['--app-bg', n.bg.hex],
    ['--app-surface', n.surface.hex],
    ['--app-surface-raised', '#ffffff'],
    ['--app-surface-sunken', n.sunken.hex],
    ['--app-surface-overlay', '#ffffff'],
    ['--app-hover', ink.alpha(0.045)],
    ['--app-active', ink.alpha(0.085)],
    ['--app-overlay', ink.alpha(0.36)],
    ['--app-border-subtle', n.borderSubtle.hex],
    ['--app-border', n.border.hex],
    ['--app-border-strong', n.borderStrong.hex],
    ['--app-border-control', n.borderControl.hex],
    ['--app-fg', n.fg.hex],
    ['--app-fg-muted', n.fgMuted.hex],
    ['--app-fg-subtle', n.fgSubtle.hex],
    ['--app-fg-disabled', n.borderStrong.hex],
    ['--app-fg-inverse', '#ffffff'],
    ['--app-accent', accent.hex],
    ['--app-accent-hover', hover.hex],
    ['--app-accent-fg', '#ffffff'],
    ['--app-accent-soft', soft.hex],
    ['--app-accent-text', text.hex],
    ['--app-accent-border', accentBorder.hex],
    ['--app-ring', accent.hex],
    ['--app-selection', (def.mono ? n.fgSubtle : new Color(0.6, chroma, hue)).alpha(0.2)],
    ['--app-tooltip-bg', n.fg.hex],
    ['--app-tooltip-fg', n.surface.hex],
    ['--app-chart-grid', n.chartGrid.hex],
    ['--app-chart-axis', n.borderStrong.hex],
    ['--app-chart-other', n.borderControl.hex],
    ['--app-shadow-xs', `0 1px 1px ${ink.alpha(0.05)}`],
    ['--app-shadow-sm', `0 1px 2px ${ink.alpha(0.07)}`],
    ['--app-shadow-card', `0 0 0 1px ${ink.alpha(0.07)}, 0 1px 2px ${ink.alpha(0.05)}`],
    [
      '--app-shadow-popover',
      `0 0 0 1px ${ink.alpha(0.08)}, 0 4px 8px ${ink.alpha(0.08)}, 0 12px 28px ${ink.alpha(0.12)}`,
    ],
    [
      '--app-shadow-overlay',
      `0 0 0 1px ${ink.alpha(0.08)}, 0 8px 16px ${ink.alpha(0.1)}, 0 24px 56px ${ink.alpha(0.18)}`,
    ],
    ['--app-div-5', n.muted.hex],
    ['--app-logo-mark', accent.hex],
    ['--app-logo-on', '#ffffff'],
    ['--app-logo-text', n.fg.hex],
    ['--app-surface-elevated', n.sunken.hex],
    ['--app-muted', n.muted.hex],
    ['--app-border-hover', n.borderStrong.hex],
    ['--app-input', n.surface.hex],
    ['--app-shadow-md', `0 4px 6px -1px ${ink.alpha(0.1)}, 0 2px 4px -1px ${ink.alpha(0.06)}`],
    ['--app-shadow-lg', `0 10px 15px -3px ${ink.alpha(0.1)}, 0 4px 6px -2px ${ink.alpha(0.05)}`],
    ['--app-shadow-xl', `0 20px 25px -5px ${ink.alpha(0.1)}, 0 10px 10px -5px ${ink.alpha(0.04)}`],
    ['--app-shadow-2xl', `0 25px 50px -12px ${ink.alpha(0.25)}`],
    ['--app-glass', 'rgb(255 255 255 / 0.72)'],
    ['--app-glass-border', ink.alpha(0.08)],
  ];
}

function darkTokens(def: PaletteDef): Tokens {
  const n = Object.fromEntries(Object.entries(NEUTRAL_L.dark).map(([k, L]) => [k, neutral(def, L)])) as Record<
    keyof typeof NEUTRAL_L.dark,
    Color
  >;
  const { hue, chroma } = def.accent;
  let accent = def.mono ? neutral(def, 0.93) : new Color(0.715, chroma * 0.75, hue);
  const hover = def.mono ? neutral(def, 0.85) : new Color(0.812, Math.min(chroma * 0.55, 0.1), hue);
  let accentFg = def.mono ? neutral(def, 0.2) : new Color(0.255, chroma * 0.45, hue);
  accentFg = ensureContrast(accentFg, accent, 4.5, `${def.name} dark text on accent`);
  accent = ensureContrast(accent, n.bg, 3, `${def.name} dark accent vs background`);
  const soft = def.mono ? n.overlay : new Color(0.289, chroma * 0.35, hue);
  const accentBorder = def.mono ? n.borderStrong : new Color(0.465, chroma * 0.93, hue);
  const text = ensureContrast(hover, soft, 4.5, `${def.name} dark accent text on soft`);

  return [
    ['--app-bg', n.bg.hex],
    ['--app-surface', n.surface.hex],
    ['--app-surface-raised', n.raised.hex],
    ['--app-surface-sunken', n.sunken.hex],
    ['--app-surface-overlay', n.overlay.hex],
    ['--app-hover', 'rgb(255 255 255 / 0.055)'],
    ['--app-active', 'rgb(255 255 255 / 0.095)'],
    ['--app-overlay', 'rgb(0 0 0 / 0.6)'],
    ['--app-border-subtle', n.borderSubtle.hex],
    ['--app-border', n.border.hex],
    ['--app-border-strong', n.borderStrong.hex],
    ['--app-border-control', n.borderControl.hex],
    ['--app-fg', n.fg.hex],
    ['--app-fg-muted', n.fgMuted.hex],
    ['--app-fg-subtle', n.fgSubtle.hex],
    ['--app-fg-disabled', n.borderStrong.hex],
    ['--app-fg-inverse', n.bg.hex],
    ['--app-accent', accent.hex],
    ['--app-accent-hover', hover.hex],
    ['--app-accent-fg', accentFg.hex],
    ['--app-accent-soft', soft.hex],
    ['--app-accent-text', text.hex],
    ['--app-accent-border', accentBorder.hex],
    ['--app-ring', accent.hex],
    ['--app-selection', (def.mono ? n.fgSubtle : new Color(0.6, chroma, hue)).alpha(0.35)],
    ['--app-tooltip-bg', n.muted.hex],
    ['--app-tooltip-fg', n.fg.hex],
    ['--app-chart-grid', n.muted.hex],
    ['--app-chart-axis', n.borderStrong.hex],
    ['--app-chart-other', n.borderControl.hex],
    ['--app-shadow-xs', '0 1px 1px rgb(0 0 0 / 0.3)'],
    ['--app-shadow-sm', '0 1px 2px rgb(0 0 0 / 0.35)'],
    ['--app-shadow-card', '0 0 0 1px rgb(255 255 255 / 0.06), 0 1px 2px rgb(0 0 0 / 0.3)'],
    [
      '--app-shadow-popover',
      '0 0 0 1px rgb(255 255 255 / 0.09), 0 4px 8px rgb(0 0 0 / 0.35), 0 12px 28px rgb(0 0 0 / 0.45)',
    ],
    [
      '--app-shadow-overlay',
      '0 0 0 1px rgb(255 255 255 / 0.09), 0 8px 16px rgb(0 0 0 / 0.4), 0 24px 56px rgb(0 0 0 / 0.55)',
    ],
    ['--app-div-5', n.borderSubtle.hex],
    ['--app-logo-mark', accent.hex],
    ['--app-logo-on', accentFg.hex],
    ['--app-logo-text', n.fg.hex],
    ['--app-surface-elevated', n.overlay.hex],
    ['--app-muted', n.muted.hex],
    ['--app-border-hover', n.borderStrong.hex],
    ['--app-input', n.surface.hex],
    ['--app-shadow-md', '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -1px rgb(0 0 0 / 0.3)'],
    ['--app-shadow-lg', '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -2px rgb(0 0 0 / 0.3)'],
    ['--app-shadow-xl', '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 10px 10px -5px rgb(0 0 0 / 0.3)'],
    ['--app-shadow-2xl', '0 25px 50px -12px rgb(0 0 0 / 0.6)'],
    ['--app-glass', n.bg.alpha(0.78)],
    ['--app-glass-border', 'rgb(255 255 255 / 0.08)'],
  ];
}

// ── Checks ───────────────────────────────────────────────────────────────────

/** WCAG 2.2 minimums: body text AAA 7:1, other text 4.5:1, UI boundaries and focus 3:1. */
const CONTRAST_RULES: Array<[fg: string, bg: string, min: number]> = [
  ['--app-fg', '--app-bg', 7],
  ['--app-fg-muted', '--app-surface-raised', 4.5],
  ['--app-fg-subtle', '--app-bg', 4.5],
  ['--app-accent-text', '--app-surface-raised', 4.5],
  ['--app-accent-text', '--app-accent-soft', 4.5],
  ['--app-accent-fg', '--app-accent', 4.5],
  ['--app-border-control', '--app-surface-raised', 3],
  ['--app-ring', '--app-bg', 3],
];

function checkContrast(name: string, mode: string, tokens: Tokens): string[] {
  const map = new Map(tokens);
  return CONTRAST_RULES.flatMap(([fg, bg, min]) => {
    const a = Color.fromHex(map.get(fg) ?? '');
    const b = Color.fromHex(map.get(bg) ?? '');
    if (!a || !b) return [`${name} ${mode}: ${fg} or ${bg} is not a hex colour`];
    const ratio = contrast(a, b);
    return ratio + 1e-9 < min ? [`${name} ${mode}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (needs ${min}:1)`] : [];
  });
}

async function referenceTokenNames(themesCss: string): Promise<string[]> {
  const css = await readFile(themesCss, 'utf8');
  const block = css.match(/\n\[data-palette='signal'\] \{([^}]*)\}/)?.[1];
  if (!block) throw new Error('gen-palettes: signal block not found in themes.css');
  return [...block.matchAll(/(--app-[a-z0-9-]+):/g)].map((m) => m[1]!).sort();
}

// ── Output ───────────────────────────────────────────────────────────────────

const here = import.meta.dirname;
const THEMES_CSS = path.resolve(here, '../src/styles/themes/themes.css');
const CSS_OUT = path.resolve(here, '../src/styles/themes/palettes.gen.css');
const TS_OUT = path.resolve(here, '../src/lib/palettes.gen.ts');

const block = (selector: string, tokens: Tokens, indent: string) =>
  `${selector} {\n${tokens.map(([k, v]) => `${indent}  ${k}: ${v};`).join('\n')}\n${indent}}`;

async function build(): Promise<{ css: string; ts: string }> {
  const expected = await referenceTokenNames(THEMES_CSS);
  const problems: string[] = [];
  const parts = [
    `/*\n * GENERATED by \`pnpm gen:palettes\` (web/gen/palettes.mts). Do not edit by hand: change the\n * PALETTES list there and regenerate. Hand-tuned palettes live in themes.css.\n */`,
  ];
  for (const def of PALETTES) {
    const light = lightTokens(def);
    const dark = darkTokens(def);
    for (const [mode, tokens] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      const names = tokens.map(([k]) => k).sort();
      if (names.join() !== expected.join()) {
        problems.push(`${def.name} ${mode}: token set differs from signal in themes.css`);
      }
      problems.push(...checkContrast(def.name, mode, tokens));
    }
    parts.push(`/* Palette ${def.name}, light. */\n${block(`[data-palette='${def.name}']`, light, '')}`);
    parts.push(
      `/* Palette ${def.name}, dark. */\n@media not print {\n  ${block(`[data-palette='${def.name}'][data-theme='dark']`, dark, '  ')}\n}`,
    );
  }
  if (problems.length) throw new Error(`gen-palettes:\n  ${problems.join('\n  ')}`);

  const ts = `// GENERATED by \`pnpm gen:palettes\` (web/gen/palettes.mts). Do not edit by hand.

/** Palettes generated into styles/themes/palettes.gen.css, in display order. */
export const GENERATED_PALETTES = [
${PALETTES.map(({ name, label }) => `  { name: '${name}', label: '${label}' },`).join('\n')}
] as const;
`;
  return { css: `${parts.join('\n\n')}\n`, ts };
}

const { css, ts } = await build();
if (process.argv.includes('--check')) {
  const [haveCss, haveTs] = await Promise.all([
    readFile(CSS_OUT, 'utf8').catch(() => ''),
    readFile(TS_OUT, 'utf8').catch(() => ''),
  ]);
  if (haveCss !== css || haveTs !== ts) {
    console.error('check-palettes: generated palette files are stale; run `pnpm gen:palettes` and commit the result.');
    process.exitCode = 1;
  } else {
    console.log(`check-palettes: ${PALETTES.length} generated palettes are up to date and pass contrast checks`);
  }
} else {
  await Promise.all([writeFile(CSS_OUT, css, 'utf8'), writeFile(TS_OUT, ts, 'utf8')]);
  console.log(`gen-palettes: wrote ${PALETTES.length} palettes (${PALETTES.map((p) => p.name).join(', ')})`);
}
