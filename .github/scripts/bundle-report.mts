/**
 * Reports the web build's asset sizes (gzip) and fails when a budget is exceeded. Run from web/
 * after `pnpm build` (which writes to server/static). In GitHub Actions the table is also written to the job summary.
 *
 * Budgets are deliberately simple; raise them consciously, in this file, in a reviewed PR.
 */
import { appendFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = {
  /** Any single JS chunk. */
  chunk: 100,
  /** All JS together (what a cold visit to the largest page could download). */
  totalJs: 250,
  css: 40,
};

const dir = path.resolve('../server/static/assets');
const rows: Array<{ file: string; kb: number }> = [];
for (const file of await readdir(dir)) {
  if (!/\.(js|css)$/.test(file)) continue;
  rows.push({ file, kb: gzipSync(await readFile(path.join(dir, file))).length / 1024 });
}
rows.sort((a, b) => b.kb - a.kb);

const js = rows.filter((r) => r.file.endsWith('.js'));
const css = rows.filter((r) => r.file.endsWith('.css'));
const sum = (list: typeof rows) => list.reduce((n, r) => n + r.kb, 0);
const failures = [
  ...js.filter((r) => r.kb > BUDGET_KB.chunk).map((r) => `${r.file} is ${r.kb.toFixed(1)} kB (budget ${BUDGET_KB.chunk} kB)`),
  ...(sum(js) > BUDGET_KB.totalJs ? [`total JS is ${sum(js).toFixed(1)} kB (budget ${BUDGET_KB.totalJs} kB)`] : []),
  ...(sum(css) > BUDGET_KB.css ? [`total CSS is ${sum(css).toFixed(1)} kB (budget ${BUDGET_KB.css} kB)`] : []),
];

const table = [
  '| Asset | gzip |',
  '| --- | ---: |',
  ...rows.map((r) => `| \`${r.file}\` | ${r.kb.toFixed(1)} kB |`),
  `| **Total JS** | **${sum(js).toFixed(1)} kB** |`,
  `| **Total CSS** | **${sum(css).toFixed(1)} kB** |`,
].join('\n');

console.log(table);
if (process.env['GITHUB_STEP_SUMMARY']) {
  await appendFile(process.env['GITHUB_STEP_SUMMARY'], `## Bundle size\n\n${table}\n`);
}
if (failures.length) {
  console.error(`\nBundle budget exceeded:\n${failures.map((f) => `  ✗ ${f}`).join('\n')}`);
  process.exitCode = 1;
}
