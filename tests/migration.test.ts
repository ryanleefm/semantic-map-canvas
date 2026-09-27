import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SemanticStore } from '../src/semantic/SemanticStore';
import { backupLegacyMetadata } from '../src/semantic/MetadataBackup';
import { fixture } from './visibility.test';
import { getVisibilityPlan } from '../src/semantic/VisibilityEngine';

const legacy = () => ({ schemaVersion: 1, canvases: {
  'folder/A.canvas': { nodes: {
    core: { level: 1, shortLabel: 'Kept label' },
    structure: { level: 2 },
    detail: { level: 3 },
  } },
  'B.canvas': { nodes: { core: { level: 3 } } },
} });
const clone = (value: unknown) => JSON.parse(JSON.stringify(value));

test('migration backs up before save, preserves identity/labels, and runs only once', async () => {
  const original = legacy();
  let disk: unknown = clone(original);
  const calls: string[] = [];
  let backup: unknown;
  const persistence = {
    load: async () => disk,
    backupLegacy: async (value: unknown) => { calls.push('backup'); backup = clone(value); },
    save: async (value: unknown) => { calls.push('save'); disk = clone(value); },
  };
  const store = new SemanticStore(persistence); await store.load();
  assert.deepEqual(calls, ['backup', 'save']);
  assert.deepEqual(backup, original);
  assert.deepEqual(disk, { schemaVersion: 2, canvases: {
    'folder/A.canvas': { nodes: { core: { level: 2, shortLabel: 'Kept label' }, structure: { level: 3 }, detail: { level: 4 } } },
    'B.canvas': { nodes: { core: { level: 4 } } },
  } });
  assert.equal(store.getShortLabel('folder/A.canvas', 'core'), 'Kept label');
  for (const s of [store, new SemanticStore(persistence)]) {
    await s.load();
    assert.equal(s.getLevel('folder/A.canvas', 'core'), 2);
    assert.equal(s.getLevel('folder/A.canvas', 'structure'), 3);
    assert.equal(s.getLevel('folder/A.canvas', 'detail'), 4);
  }
  assert.deepEqual(calls, ['backup', 'save']);
  await store.setLevel('folder/A.canvas', 'core', 1);
  const reload = new SemanticStore(persistence); await reload.load();
  assert.equal(reload.getLevel('folder/A.canvas', 'core'), 1);
  assert.equal(reload.getLevel('new.canvas', 'g', 'group'), 2);
  for (const type of ['text', 'file', 'link']) assert.equal(reload.getLevel('new.canvas', type, type), 3);
});

test('invalid legacy/current/future documents never start backup or save', async () => {
  for (const input of [
    { schemaVersion: 1, canvases: { 'A.canvas': { nodes: { n: { level: 4 } } } } },
    { schemaVersion: 2, canvases: { 'A.canvas': { nodes: { n: { level: 5 } } } } },
    { schemaVersion: 2, canvases: { 'A.canvas': { nodes: { n: { level: '2' } } } } },
    { schemaVersion: 1, canvases: { 'A.canvas': { nodes: { n: { level: 1, shortLabel: 42 } } } } },
    { schemaVersion: 3, canvases: {} },
  ]) {
    let writes = 0;
    const store = new SemanticStore({
      load: async () => input,
      save: async () => { writes++; },
      backupLegacy: async () => { writes++; },
    });
    await assert.rejects(store.load());
    await assert.rejects(store.setLevel('A.canvas', 'n', 1), /not ready/);
    assert.equal(writes, 0);
  }
});

test('backup failure prevents migration and editing, and retry can recover', async () => {
  const original = legacy(); let disk: unknown = original; let fail = true; let writes = 0;
  const persistence = {
    load: async () => disk,
    backupLegacy: async () => { if (fail) throw new Error('Backup unavailable'); },
    save: async (data: unknown) => { disk = clone(data); writes++; },
  };
  const store = new SemanticStore(persistence);
  await assert.rejects(store.load(), /Backup unavailable/);
  await assert.rejects(store.setLevel('A.canvas', 'n', 1), /not ready/);
  assert.equal(disk, original); assert.equal(writes, 0);
  fail = false; await store.load();
  assert.equal(store.getLevel('folder/A.canvas', 'detail'), 4);
  assert.equal(writes, 1);
});

test('partial migration write is restored before reporting failure; retry is safe', async () => {
  const original = legacy(); let disk: unknown = clone(original); let fail = true; let backup: unknown;
  const persistence = {
    load: async () => disk,
    backupLegacy: async (data: unknown) => { backup = clone(data); },
    save: async (data: unknown) => {
      if (fail && (data as any).schemaVersion === 2) { disk = { partial: true }; throw new Error('Write interrupted'); }
      disk = clone(data);
    },
  };
  const store = new SemanticStore(persistence);
  await assert.rejects(store.load(), /Write interrupted/);
  assert.deepEqual(disk, original); assert.deepEqual(backup, original);
  assert.equal(store.revision, 0);
  await assert.rejects(store.setLevel('A.canvas', 'n', 1), /not ready/);
  fail = false; await store.load();
  assert.equal(store.getLevel('folder/A.canvas', 'core'), 2);
});

test('failed restoration retains backup and leaves metadata editing disabled', async () => {
  const original = legacy(); let backup: unknown;
  const store = new SemanticStore({
    load: async () => original,
    backupLegacy: async (data: unknown) => { backup = clone(data); },
    save: async () => { throw new Error('Disk unavailable'); },
  });
  await assert.rejects(store.load(), /migration and restoration failed/);
  assert.deepEqual(backup, original);
  await assert.rejects(store.setLevel('A.canvas', 'n', 1), /not ready/);
});

test('backup file is verified, reused on retry and never replaces a different backup', async () => {
  const files = new Map<string, string>();
  let writes = 0;
  const adapter = {
    exists: async (p: string) => files.has(p),
    read: async (p: string) => files.get(p)!,
    write: async (p: string, text: string) => { writes++; files.set(p, text); },
  };
  const dir = '.obsidian/plugins/semantic-map-canvas';
  const path = dir + '/data.schema-v1.backup.json';
  await backupLegacyMetadata(adapter, dir, legacy());
  assert.deepEqual(JSON.parse(files.get(path)!), legacy());
  await backupLegacyMetadata(adapter, dir, legacy());
  assert.equal(writes, 1);
  const changed = legacy(); changed.canvases['B.canvas'].nodes.core.level = 2;
  await backupLegacyMetadata(adapter, dir, changed);
  assert.equal(writes, 2); assert.deepEqual(JSON.parse(files.get(path)!), legacy());
  assert.deepEqual(JSON.parse(files.get(dir + '/data.schema-v1.backup.1.json')!), changed);
  const broken = { ...adapter, write: async (p: string) => { files.set(p, 'partial'); } };
  await assert.rejects(backupLegacyMetadata(broken, 'another-plugin', legacy()), /verification failed/);
});

test('migration and verified backup survive actual file writes and reload', async () => {
  const { mkdir, readFile, writeFile, access } = await import('node:fs/promises');
  const dir = '.test-build/phase7-persistence';
  await mkdir(dir, { recursive: true });
  const path = dir + '/data.json';
  await writeFile(path, JSON.stringify(legacy()));
  const adapter = {
    exists: async (p: string) => { try { await access(p); return true; } catch { return false; } },
    read: async (p: string) => readFile(p, 'utf8'),
    write: async (p: string, text: string) => { await writeFile(p, text); },
  };
  const persistence = {
    load: async () => JSON.parse(await readFile(path, 'utf8')) as unknown,
    save: async (data: unknown) => { await writeFile(path, JSON.stringify(data)); },
    backupLegacy: (data: unknown) => backupLegacyMetadata(adapter, dir, data),
  };
  const store = new SemanticStore(persistence); await store.load();
  assert.equal((await persistence.load() as any).schemaVersion, 2);
  assert.deepEqual(JSON.parse(await readFile(dir + '/data.schema-v1.backup.json', 'utf8')), legacy());
  await store.setLevel('A.canvas', 'group', 4);
  const reload = new SemanticStore(persistence); await reload.load();
  assert.equal(reload.getLevel('A.canvas', 'group', 'group'), 4);
  assert.equal(reload.getLevel('folder/A.canvas', 'core'), 2);
});

test('migrated levels match current visibility by meaning, and groups now honor their levels', async () => {
  const f = await fixture(); const before = f.geometry();
  const data = { schemaVersion: 1, canvases: { 'A.canvas': { nodes: {
    core: { level: 1 }, inside: { level: 2 }, detail: { level: 3 },
  } } } };
  const store = new SemanticStore({
    load: async () => data, backupLegacy: async () => {}, save: async () => {},
  }); await store.load();
  for (const mode of ['DETAIL', 'STRUCTURE', 'OVERVIEW'] as const) {
    assert.deepEqual(getVisibilityPlan(f.read(), mode, 'A.canvas', store),
      getVisibilityPlan(f.read(), mode, 'A.canvas', f.store));
  }
  await store.setLevel('A.canvas', 'core', 1);
  for (const mode of ['STRUCTURE', 'OVERVIEW'] as const) {
    assert.equal(getVisibilityPlan(f.read(), mode, 'A.canvas', store).nodes.get('core')?.visible, true);
  }
  // Phase 8 consumes the group metadata introduced in Phase 7.
  await store.setLevel('A.canvas', 'group', 4);
  assert.equal(getVisibilityPlan(f.read(), 'OVERVIEW', 'A.canvas', store).nodes.get('group')?.visible, false);
  assert.equal(f.geometry(), before);
});
