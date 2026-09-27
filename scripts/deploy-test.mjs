import { copyFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
function ensureInside(path) {
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error(`Refusing a destination outside project: ${path}`);
  }
}
// Resolve each existing component before writing, rejecting junctions/symlinks
// that redirect this test deployment outside the project.
let target = root;
for (const name of ['VaultsforTest', '.obsidian', 'plugins', 'semantic-map-canvas']) {
  target = join(target, name);
  try {
    target = await realpath(target);
    ensureInside(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(target);
    target = await realpath(target);
    ensureInside(target);
  }
}
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  const destination = join(target, name);
  try { ensureInside(await realpath(destination)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await copyFile(join(root, name), destination);
}
console.log(`Deployed to ${target}`);
