/**
 * `pnpm gen:fonts`: downloads the UI fonts from Google Fonts into src/styles/fonts/ and writes
 * fonts.css, so the app self-hosts them and loads nothing from another host at runtime.
 * The outputs are committed; rerun only to change families, weights or subsets.
 */
import { writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT_DIR = join(import.meta.dirname, '..');

// Store both CSS and .woff2 binaries together in src/styles/fonts
const FONTS_DIR = join(ROOT_DIR, 'src', 'styles', 'fonts');
const FONTS_CSS_FILE = join(FONTS_DIR, 'fonts.css');

interface FontConfig {
  name: string;
  family: string;
  weights: number[];
}

// UI sans, display headings, code mono: the stacks in src/styles/tokens/tokens.css.
const FONTS_CONFIG: FontConfig[] = [
  { name: 'Inter', family: 'Inter', weights: [400, 500, 600, 700] },
  { name: 'Space Grotesk', family: 'Space+Grotesk', weights: [500, 600, 700] },
  { name: 'JetBrains Mono', family: 'JetBrains+Mono', weights: [400, 500] },
];

// Google serves one file per script subset. Only these are downloaded; add e.g. 'latin-ext' or
// 'cyrillic' for other languages. Each @font-face gets its unicode-range, so browsers fetch a
// subset file only when the page uses its characters.
const SUBSETS = ['latin'];

/**
 * Build Google Fonts API v2 request URL for target families and weights
 */
function buildGoogleFontsUrl(config: FontConfig[]): string {
  const familiesParam = config
    .map(({ family, weights }) => {
      const sortedWeights = weights.sort((a, b) => a - b).join(';');
      return `family=${family}:wght@${sortedWeights}`;
    })
    .join('&');

  return `https://fonts.googleapis.com/css2?${familiesParam}&display=swap`;
}

/**
 * Fetch Google Fonts CSS using a modern browser User-Agent to receive WOFF2 links
 */
async function fetchGoogleFontsCss(url: string, retries = 3): Promise<string> {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 400 * i));
    }
  }
  // Unreachable: loop either returns or throws on the final attempt.
  throw new Error('fetchGoogleFontsCss: exhausted retries without returning or throwing');
}

interface ParsedFontFace {
  family: string;
  style: string;
  weight: string;
  url: string;
  subset: string;
  unicodeRange: string | undefined;
}

/**
 * Extract `@font-face` blocks with their metadata. Google precedes each block with a
 * `/* <subset> *\/` comment, which is the only place the subset is named.
 */
function parseCssBlocks(css: string): ParsedFontFace[] {
  const blocks: ParsedFontFace[] = [];
  const fontFaceRegex = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = fontFaceRegex.exec(css)) !== null) {
    const subset = match[1] ?? 'unknown';
    const body = match[2] ?? '';

    const fontFamily = body.match(/font-family:\s*['"]?([^'"]+)['"]?;/)?.[1];
    const fontStyle = body.match(/font-style:\s*([^;]+);/)?.[1] || 'normal';
    const fontWeight = body.match(/font-weight:\s*([^;]+);/)?.[1] || '400';
    const urlMatch = body.match(/url\((https:\/\/[^)]+)\)/)?.[1];
    const unicodeRange = body.match(/unicode-range:\s*([^;]+);/)?.[1];

    if (fontFamily && urlMatch) {
      blocks.push({
        family: fontFamily,
        style: fontStyle,
        weight: fontWeight,
        url: urlMatch,
        subset,
        unicodeRange,
      });
    }
  }

  return blocks;
}

/**
 * Fetch remote binary font file with retry logic
 */
async function downloadFontFile(url: string, retries = 3): Promise<Buffer> {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 400 * i));
    }
  }
  // Unreachable: loop either returns or throws on the final attempt.
  throw new Error('downloadFontFile: exhausted retries without returning or throwing');
}

async function main(): Promise<void> {
  const totalFonts = FONTS_CONFIG.length;
  const familyNames = FONTS_CONFIG.map((font) => font.name).join(', ');
  console.log(`Processing ${totalFonts} font families (${familyNames})…\n`);

  await mkdir(FONTS_DIR, { recursive: true });
  for (const file of await readdir(FONTS_DIR)) {
    if (file.endsWith('.woff2')) await rm(join(FONTS_DIR, file));
  }

  const gfontsUrl = buildGoogleFontsUrl(FONTS_CONFIG);
  console.log(`Fetching CSS metadata from Google Fonts…`);

  const rawCss = await fetchGoogleFontsCss(gfontsUrl);
  const parsedFonts = parseCssBlocks(rawCss);

  if (!parsedFonts.length) {
    throw new Error('No font-face rules extracted from Google Fonts response.');
  }

  const generatedCssRules: string[] = [];
  // Variable families return the same file for every weight; download each URL once.
  const filesByUrl = new Map<string, string>();
  let downloadedCount = 0;
  let errorCount = 0;

  for (const font of parsedFonts.filter((f) => SUBSETS.includes(f.subset))) {
    const slug = font.family.toLowerCase().replace(/\s+/g, '-');
    let filename = filesByUrl.get(font.url);

    if (!filename) {
      filename = `${slug}-${font.subset}-${font.style}-${font.weight}.woff2`;
      try {
        const buffer = await downloadFontFile(font.url);
        await writeFile(join(FONTS_DIR, filename), buffer);
        filesByUrl.set(font.url, filename);
        downloadedCount++;
        process.stdout.write(`  ✓ ${font.family} ${font.subset} (${font.weight}, ${font.style}) → ${filename}\n`);
      } catch (err) {
        errorCount++;
        const message = err instanceof Error ? err.message : String(err);
        process.stdout.write(`  ✗ Failed to download ${font.family} ${font.subset} (${font.weight}): ${message}\n`);
        continue;
      }
    }

    // Co-located relative URL inside src/styles/fonts/
    const range = font.unicodeRange ? `\n  unicode-range: ${font.unicodeRange};` : '';
    generatedCssRules.push(`@font-face {
  font-family: '${font.family}';
  font-style: ${font.style};
  font-weight: ${font.weight};
  font-display: swap;
  src: url('./${filename}') format('woff2');${range}
}`);
  }

  const headerNotice = `/* Auto-generated by gen/fonts.mts (pnpm gen:fonts). DO NOT EDIT MANUALLY. */\n\n`;
  const fullCss = headerNotice + generatedCssRules.join('\n\n') + '\n';

  await writeFile(FONTS_CSS_FILE, fullCss, 'utf-8');

  console.log(`\n✓ ${downloadedCount} font files saved to src/styles/fonts/ (subsets: ${SUBSETS.join(', ')})`);
  if (errorCount) {
    console.log(`✗ ${errorCount} fonts failed to download.`);
  }
  console.log(`Generated: ${FONTS_CSS_FILE}`);
}

main().catch((err) => {
  console.error('Fatal: ', err);
  process.exit(1);
});
