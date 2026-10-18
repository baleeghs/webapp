/**
 * `pnpm gen:icons`: fetches Material Symbols (Rounded, falling back to Outlined) as SVG path data
 * into src/components/icons/svg.ts, so icons are tree-shaken inline SVG with no icon font or
 * runtime fetch. The output is committed. `--force` refetches every icon.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ICONS_DIR = join(import.meta.dirname, '..', 'src', 'components', 'icons');
const SVG_FILE = join(ICONS_DIR, 'svg.ts');

// Delimiters used to locate and parse embedded JSON inside the generated TypeScript file
const JSON_START = '/*__ICONS_JSON_START__*/';
const JSON_END = '/*__ICONS_JSON_END__*/';

// App-facing names: outlined = rounded outline, filled = rounded filled.
type IconVariant = 'outlined' | 'filled';

/** Per-variant SVG path `d` strings. Not every icon has every variant. */
type IconPaths = Partial<Record<IconVariant, string[]>>;

/** Full icon dataset keyed by application icon identifier. */
type IconData = Record<string, IconPaths>;

const VARIANT_ORDER: IconVariant[] = ['outlined', 'filled'];

type VariantUrlFn = (name: string, set: SymbolSet) => string;

/** Material Symbols sets, in order of preference: Rounded, then Outlined when Rounded lacks a glyph. */
const SETS = ['materialsymbolsrounded', 'materialsymbolsoutlined'] as const;
type SymbolSet = (typeof SETS)[number];

const VARIANT_URLS: Record<IconVariant, VariantUrlFn> = {
  outlined: (name, set) => `https://fonts.gstatic.com/s/i/short-term/release/${set}/${name}/default/24px.svg`,
  filled: (name, set) => `https://fonts.gstatic.com/s/i/short-term/release/${set}/${name}/fill1/24px.svg`,
};

// Map app icon identifiers to Google Material Symbols names (https://fonts.google.com/icons).
// To add an icon: add a line here and run `pnpm gen:icons`. Keep names stable: the generated
// file is keyed by them, and cached entries are reused without a network fetch.
const ICON_MAP: Record<string, string> = {
  // Shell and navigation
  MENU: 'menu',
  SIDEBAR_CLOSE: 'left_panel_close',
  SIDEBAR_OPEN: 'left_panel_open',
  HOME: 'home',
  SEARCH: 'search',
  CLOSE: 'close',
  CHEVRON_DOWN: 'expand_more',
  CHEVRON_UP: 'expand_less',
  CHEVRON_RIGHT: 'chevron_right',
  CHEVRON_LEFT: 'chevron_left',
  ARROW_BACK: 'arrow_back',
  ARROW_FORWARD: 'arrow_forward',
  OPEN_IN_NEW: 'open_in_new',
  MORE: 'more_horiz',
  MORE_VERTICAL: 'more_vert',
  SETTINGS: 'settings',
  HELP: 'help',
  BOOK: 'book',
  // Appearance
  SUN: 'light_mode',
  MOON: 'dark_mode',
  DESKTOP: 'desktop_windows',
  PALETTE: 'palette',
  DENSITY: 'density_medium',
  // Content and data
  NOTE: 'sticky_note_2',
  PAGE: 'description',
  FOLDER: 'folder',
  TABLE: 'table_chart',
  LIST: 'list',
  FILTER: 'filter_list',
  SORT: 'sort',
  CALENDAR: 'calendar_month',
  SCHEDULE: 'schedule',
  USER: 'person',
  USERS: 'group',
  LINK: 'link',
  // Actions
  PLUS: 'add',
  EDIT: 'edit',
  TRASH: 'delete',
  COPY: 'content_copy',
  CHECK: 'check',
  REFRESH: 'refresh',
  DOWNLOAD: 'download',
  UPLOAD: 'upload',
  SAVE: 'save',
  LOGOUT: 'logout',
  // Status and feedback
  INFO: 'info',
  ALERT: 'warning',
  ERROR: 'error',
  CHECK_CIRCLE: 'check_circle',
  CANCEL: 'cancel',
  CLOUD_OFF: 'cloud_off',
  LOCK: 'lock',
  EYE: 'visibility',
  EYE_OFF: 'visibility_off',
};

/**
 * Extract path `d` attribute strings from raw SVG XML
 */
function extractPaths(svg: string): string[] {
  const paths: string[] = [];
  const re = /<path\s+d="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    if (match[1]) paths.push(match[1]);
  }
  return paths;
}

/**
 * Fetch remote SVG with exponential backoff retries for resilient downloads
 */
async function fetchSvg(url: string, retries = 3): Promise<string> {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 400 * i));
    }
  }
  // Unreachable: loop either returns or throws on the final attempt.
  throw new Error('fetchSvg: exhausted retries without returning or throwing');
}

/**
 * Extract existing cached JSON data embedded inside `svg.ts` to prevent unnecessary re-fetches
 */
async function loadExisting(file: string): Promise<IconData> {
  try {
    const txt = await readFile(file, 'utf-8');
    const start = txt.indexOf(JSON_START);
    const end = txt.indexOf(JSON_END);
    if (start === -1 || end === -1) return {};
    const json = txt.slice(start + JSON_START.length, end);
    return JSON.parse(json) as IconData;
  } catch {
    return {};
  }
}

interface FetchIconResult {
  paths: IconPaths;
  failures: string[];
  /** The set each fetched variant came from. */
  sets: Partial<Record<IconVariant, SymbolSet>>;
}

/** Fetches one variant, trying each set in {@link SETS} order. */
async function fetchVariant(
  materialName: string,
  variant: IconVariant,
): Promise<{ variant: IconVariant; paths: string[]; set: SymbolSet }> {
  const errors: string[] = [];
  for (const set of SETS) {
    try {
      const paths = extractPaths(await fetchSvg(VARIANT_URLS[variant](materialName, set)));
      if (paths.length) return { variant, paths, set };
      errors.push(`${set}: no paths`);
    } catch (err) {
      errors.push(`${set}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`${variant}: ${errors.join('; ')}`);
}

/**
 * Fetch all variant SVGs for a single icon in parallel and collect valid path data
 */
async function fetchIcon(materialName: string): Promise<FetchIconResult> {
  const results = await Promise.allSettled(VARIANT_ORDER.map((variant) => fetchVariant(materialName, variant)));

  const collected: Partial<Record<IconVariant, string[]>> = {};
  const sets: Partial<Record<IconVariant, SymbolSet>> = {};
  const failures: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      collected[result.value.variant] = result.value.paths;
      sets[result.value.variant] = result.value.set;
    } else {
      failures.push(result.reason?.message ?? String(result.reason));
    }
  }

  // Preserve deterministic order based on VARIANT_ORDER
  const ordered: IconPaths = {};
  for (const variant of VARIANT_ORDER) {
    if (collected[variant]) ordered[variant] = collected[variant];
  }

  return { paths: ordered, failures, sets };
}

/**
 * Format gathered icon paths into a strongly-typed TypeScript module
 */
function generateModule(data: IconData): string {
  const json = JSON.stringify(data, null, 2);
  return `// Auto-generated by gen/icons.mts (pnpm gen:icons). DO NOT EDIT MANUALLY.
// Re-run the script to add or refresh icons.

export type IconVariant = 'outlined' | 'filled';

/** Per-variant SVG path \`d\` strings. Not every icon has every variant. */
export type IconPaths = Partial<Record<IconVariant, string[]>>;

export const icons = ${JSON_START}${json}${JSON_END} satisfies Record<string, IconPaths>;

export type IconName = keyof typeof icons;
`;
}

async function main(): Promise<void> {
  const forceDownload = process.argv.includes('--force');
  const total = Object.keys(ICON_MAP).length;
  console.log(`Fetching ${total} icons × ${VARIANT_ORDER.length} variants…\n`);

  await mkdir(ICONS_DIR, { recursive: true });

  const existing = forceDownload ? {} : await loadExisting(SVG_FILE);

  const data: IconData = {};
  let fetched = 0;
  let cached = 0;
  let errors = 0;
  const errorList: string[] = [];
  /** Names with no fresh glyph: missing entirely, or kept from the cache after a failed fetch. */
  const notFetched: string[] = [];

  for (const [name, materialName] of Object.entries(ICON_MAP)) {
    // Reuse cached data unless forced via --force flag
    if (!forceDownload && existing[name] && Object.keys(existing[name]).length) {
      data[name] = existing[name];
      process.stdout.write(`  ~ ${name} (cached)\n`);
      cached++;
      continue;
    }

    const { paths, failures, sets } = await fetchIcon(materialName);

    if (Object.keys(paths).length) {
      data[name] = paths;
      fetched++;
      const fallback = Object.values(sets).some((set) => set !== SETS[0]) ? ' (Outlined fallback)' : '';
      process.stdout.write(`  ✓ ${name}  ←  ${materialName}${fallback}\n`);
    } else if (existing[name]) {
      data[name] = existing[name];
      notFetched.push(`${name} (${materialName}, kept cached)`);
      process.stdout.write(`  ! ${name} (fetch failed, kept cached)\n`);
    } else {
      notFetched.push(`${name} (${materialName})`);
      process.stdout.write(`  ✗ ${name} (fetch failed)\n`);
    }

    for (const failure of failures) {
      errors++;
      errorList.push(`${name} (${materialName}): ${failure}`);
    }
  }

  // Write finalized module to src/components/icons/svg.ts, sorted so diffs stay small
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(SVG_FILE, generateModule(sorted), 'utf-8');

  const iconCount = Object.keys(data).length;
  console.log(`\n✓ ${fetched} icons fetched, ${cached} reused from cache.`);
  if (errors) {
    console.log(`✗ ${errors} variant errors:`);
    errorList.forEach((e) => console.log(`  - ${e}`));
  }
  console.log(`\nGenerated: ${SVG_FILE} (${iconCount} icons)`);
  if (notFetched.length) {
    console.log(`\n✗ Could not fetch ${notFetched.length} icon(s); check the Material Symbols names:`);
    notFetched.forEach((n) => console.log(`  - ${n}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal: ', err);
  process.exit(1);
});
