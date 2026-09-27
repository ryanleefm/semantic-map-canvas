import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({entryPoints:['tests/performance.bench.ts'],outfile:'.test-build/performance.bench.mjs',bundle:true,platform:'node',format:'esm',external:['linkedom']});
const result=spawnSync(process.execPath,['.test-build/performance.bench.mjs'],{stdio:'inherit'});
process.exitCode=result.status??1;
