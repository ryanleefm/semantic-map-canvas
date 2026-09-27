import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: ['tests/prototype.test.ts'],
  outfile: '.test-build/prototype.test.cjs',
  bundle: true,
  external: ['linkedom'],
  platform: 'node',
  format: 'cjs',
  alias: { obsidian: fileURLToPath(new URL('../tests/obsidian-stub.ts', import.meta.url)) },
});
const result = spawnSync(process.execPath, ['--test', '.test-build/prototype.test.cjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
