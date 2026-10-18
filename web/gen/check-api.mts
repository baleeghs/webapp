/**
 * `pnpm check:api`: fails when src/lib/api/schema.gen.ts is stale, i.e. differs from what
 * `pnpm gen:api` would generate from ../server/openapi.yaml right now. Regenerates into a
 * temporary directory with the local openapi-typescript (same CLI as `gen:api`) and compares; the
 * committed file is never touched.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..');
const spec = path.resolve(webDir, '../server/openapi.yaml');
const committed = path.join(webDir, 'src/lib/api/schema.gen.ts');
const bin = path.join(webDir, 'node_modules/.bin', 'openapi-typescript');

const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'app-api-types-'));
try {
  const fresh = path.join(tmpDir, 'schema.gen.ts');
  execFileSync(bin, [spec, '-o', fresh], { cwd: webDir, stdio: ['ignore', 'ignore', 'inherit'] });
  const [want, have] = await Promise.all([readFile(fresh, 'utf8'), readFile(committed, 'utf8')]);
  if (want === have) {
    console.log('check-api: src/lib/api/schema.gen.ts is up to date with server/openapi.yaml');
  } else {
    const a = have.split('\n');
    const b = want.split('\n');
    let first = 0;
    while (first < a.length && first < b.length && a[first] === b[first]) first++;
    console.error('check-api: src/lib/api/schema.gen.ts is stale; run `pnpm gen:api` and commit the result.');
    console.error(`  first difference at line ${first + 1} (committed ${a.length} lines, generated ${b.length}):`);
    console.error(`  - ${a[first] ?? '<end of file>'}`);
    console.error(`  + ${b[first] ?? '<end of file>'}`);
    process.exitCode = 1;
  }
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}
