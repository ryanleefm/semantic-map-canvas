import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SemanticStore } from '../src/semantic/SemanticStore';
import { registerSemanticMenu } from '../src/semantic/SemanticMenu';
import { CanvasAdapter } from '../src/canvas/CanvasAdapter';
import { Menu, Notice, Plugin, TestEvents } from './obsidian-stub';

function storage(initial: unknown = null) {
  let disk = initial;
  let fail = false;
  const writes: unknown[] = [];
  const backups: unknown[] = [];
  const persistence = {
    load: async () => disk,
    backupLegacy: async (value: unknown) => { backups.push(JSON.parse(JSON.stringify(value))); },
    save: async (value: unknown) => {
      if (fail) throw new Error('Disk full');
      disk = JSON.parse(JSON.stringify(value)); writes.push(disk);
    },
  };
  return { store: new SemanticStore(persistence), persistence, writes, backups, disk: () => disk, setFail: (value: boolean) => { fail = value; } };
}

test('defaults to L3 for ordinary nodes and L2 for groups, isolates canvases, and survives reload', async () => {
  const h = storage(); await h.store.load();
  assert.equal(h.store.getLevel('A.canvas', 'n'), 3);
  assert.equal(h.store.getLevel('A.canvas', 'g', 'group'), 2);
  assert.equal(h.writes.length, 0);
  await h.store.setLevel('A.canvas', 'n', 1);
  await h.store.setLevel('B.canvas', 'n', 3);
  const reloaded = new SemanticStore(h.persistence); await reloaded.load();
  assert.equal(reloaded.getLevel('A.canvas', 'n'), 1);
  assert.equal(reloaded.getLevel('B.canvas', 'n'), 3);
  await reloaded.setLevel('A.canvas', 'n', 2);
  assert.equal(reloaded.getLevel('A.canvas', 'n'), 2);
});

test('rapid writes serialize and failures do not commit or poison later writes', async () => {
  const h = storage(); await h.store.load();
  await Promise.all([h.store.setLevel('A.canvas', 'a', 1), h.store.setLevel('A.canvas', 'b', 3)]);
  assert.equal(h.store.getLevel('A.canvas', 'a'), 1);
  assert.equal(h.store.getLevel('A.canvas', 'b'), 3);
  h.setFail(true);
  await assert.rejects(h.store.setLevel('A.canvas', 'a', 3), /Disk full/);
  assert.equal(h.store.getLevel('A.canvas', 'a'), 1);
  h.setFail(false); await h.store.setLevel('A.canvas', 'a', 2);
  assert.equal(h.store.getLevel('A.canvas', 'a'), 2);
});

test('rename/delete handle folders, path boundaries and pending writes', async () => {
  const h = storage(); await h.store.load();
  await Promise.all([h.store.setLevel('folder/A.canvas', 'n', 1), h.store.setLevel('folder-other/B.canvas', 'n', 3), h.store.renamePath('folder', 'moved')]);
  assert.equal(h.store.getLevel('moved/A.canvas', 'n'), 1);
  assert.equal(h.store.getLevel('folder/A.canvas', 'n'), 3);
  await h.store.renamePath('moved/A.canvas', 'moved/C.canvas');
  assert.equal(h.store.getLevel('moved/C.canvas', 'n'), 1);
  await h.store.deletePath('moved');
  assert.equal(h.store.getLevel('moved/C.canvas', 'n'), 3);
  assert.equal(h.store.getLevel('folder-other/B.canvas', 'n'), 3);
  const count = h.writes.length; await h.store.deletePath('unrelated.md');
  assert.equal(h.writes.length, count);
});

test('rejects corrupt/newer metadata without writing and preserves short labels', async () => {
  for (const bad of [{}, { schemaVersion: 3, canvases: {} }, { schemaVersion: 1, canvases: { a: { nodes: { n: { level: 4 } } } } }]) {
    const h = storage(bad); await assert.rejects(h.store.load());
    assert.equal(h.writes.length, 0); assert.equal(h.disk(), bad);
  }
  const h = storage({ schemaVersion: 1, canvases: { 'A.canvas': { nodes: { n: { level: 1, shortLabel: 'Core' } } } } });
  await h.store.load(); await h.store.setLevel('A.canvas', 'n', 3);
  assert.equal((h.disk() as any).canvases['A.canvas'].nodes.n.shortLabel, 'Core');
});

test('prototype-like IDs are safe and invalid targets rejected', async () => {
  const h = storage(); await h.store.load();
  await h.store.setLevel('A.canvas', '__proto__', 1);
  assert.equal(h.store.getLevel('A.canvas', '__proto__'), 1);
  assert.equal(h.store.getLevel('A.canvas', 'constructor'), 3);
  await assert.rejects(h.store.setLevel('A.md', 'n', 1));
});

async function menuHarness() {
  const h = storage(); await h.store.load();
  const workspace = new TestEvents();
  const vault = Object.assign(new TestEvents(), { getAbstractFileByPath: () => ({}) });
  const canvas = { view: { file: { path: 'A.canvas' } }, nodes: new Map() };
  const data = Object.freeze({ id: 'n', type: 'text', x: 10, y: 20, width: 300, height: 200, text: 'Original' });
  const node = { canvas, getData: () => data }; canvas.nodes.set('n', node);
  const app = { workspace, vault }; const plugin = new Plugin(); plugin.app = app;
  registerSemanticMenu(plugin as never, new CanvasAdapter(app as never), h.store);
  const open = (target: unknown = node) => {
    const menu = new Menu(); menu.addItem(item => item.setTitle('Native item'));
    workspace.emit('canvas:node-menu', menu, target); return menu;
  };
  return { ...h, workspace, vault, canvas, node, data, plugin, open };
}

test('native menu adds checked levels and saves without changing Canvas data', async () => {
  const h = await menuHarness(); const before = JSON.stringify(h.data); const menu = h.open();
  assert.equal(menu.items[0]?.title, 'Native item');
  assert.equal(menu.items[1]?.title, 'Semantic level');
  const items = menu.items[1]!.submenu!.items;
  assert.deepEqual(items.map(i => [i.title, i.checked]), [['L1 Domain', false], ['L2 Core', false], ['L3 Structure', true], ['L4 Detail', false]]);
  await items[3]!.callback();
  assert.equal(h.store.getLevel('A.canvas', 'n'), 4);
  assert.equal(h.open().items[1]!.submenu!.items[3]!.checked, true);
  assert.equal(JSON.stringify(h.data), before); assert.equal(h.canvas.nodes.size, 1);
});

test('menu resolves renamed paths at click time and ignores removed nodes and accepts groups', async () => {
  const h = await menuHarness(); const menu = h.open(); h.canvas.view.file.path = 'B.canvas';
  await menu.items[1]!.submenu!.items[0]!.callback();
  assert.equal(h.store.getLevel('B.canvas', 'n'), 1); assert.equal(h.store.getLevel('A.canvas', 'n'), 3);
  h.canvas.nodes.delete('n'); await menu.items[1]!.submenu!.items[2]!.callback();
  assert.equal(h.store.getLevel('B.canvas', 'n'), 1);
  const group = { canvas: h.canvas, getData: () => ({ id: 'g', type: 'group' }) }; h.canvas.nodes.set('g', group);
  const groupItems = h.open(group).items[1]!.submenu!.items;
  assert.equal(groupItems[1]!.checked, true);
  await groupItems[0]!.callback();
  assert.equal(h.store.getLevel('B.canvas', 'g', 'group'), 1);
  const reload = new SemanticStore(h.persistence); await reload.load();
  assert.equal(reload.getLevel('B.canvas', 'g', 'group'), 1);
});

test('disable removes listeners and deactivates already open menus', async () => {
  const h = await menuHarness(); const menu = h.open();
  for (const cleanup of h.plugin.cleanups) cleanup();
  await menu.items[1]!.submenu!.items[0]!.callback();
  assert.equal(h.writes.length, 0); assert.equal(h.open().items.length, 1);
  assert.equal(h.workspace.listeners.get('canvas:node-menu')?.size, 0);
  assert.equal(h.vault.listeners.get('rename')?.size, 0);
  assert.equal(h.vault.listeners.get('delete')?.size, 0);
});

test('save failures are visible and retain previous level', async () => {
  const h = await menuHarness(); const original = console.error; console.error = () => {}; Notice.messages.length = 0;
  try {
    h.setFail(true); await h.open().items[1]!.submenu!.items[0]!.callback();
    assert.equal(h.store.getLevel('A.canvas', 'n'), 3);
    assert.ok(Notice.messages.at(-1)?.includes('could not be saved'));
  } finally { console.error = original; }
});

test('vault events migrate and delete metadata', async () => {
  const h = await menuHarness(); await h.store.setLevel('A.canvas', 'n', 1);
  h.vault.emit('rename', { path: 'B.canvas' }, 'A.canvas'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.store.getLevel('B.canvas', 'n'), 1);
  h.vault.emit('delete', { path: 'B.canvas' }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.store.getLevel('B.canvas', 'n'), 3);
});

test('metadata survives a real JSON file write/read cycle', async () => {
  const { mkdir, readFile, writeFile } = await import('node:fs/promises');
  // The bundled CJS test runs from .test-build; use a workspace-relative fixture.
  const path = '.test-build/persistence/data.json';
  await mkdir('.test-build/persistence', { recursive: true });
  await writeFile(path, 'null');
  const persistence = {
    load: async () => JSON.parse(await readFile(path, 'utf8')) as unknown,
    save: async (data: unknown) => { await writeFile(path, JSON.stringify(data)); },
  };
  const first = new SemanticStore(persistence); await first.load();
  await first.setLevel('A.canvas', 'n', 1);
  const second = new SemanticStore(persistence); await second.load();
  assert.equal(second.getLevel('A.canvas', 'n'), 1);
});
