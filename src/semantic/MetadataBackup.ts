import { normalizePath, type DataAdapter } from 'obsidian';

type BackupAdapter = Pick<DataAdapter, 'exists' | 'read' | 'write'>;

/** Keep a verified copy in the plugin folder before replacing schema v1 data. */
export async function backupLegacyMetadata(adapter: BackupAdapter, directory: string, data: unknown): Promise<void> {
  const contents = JSON.stringify(data, null, 2) + '\n';
  // Reuse an identical backup on retry; never replace a different or partial backup.
  for (let index = 0; index < 100; index++) {
    const suffix = index === 0 ? '' : '.' + index;
    const path = normalizePath(directory + '/data.schema-v1.backup' + suffix + '.json');
    if (await adapter.exists(path)) {
      if (await adapter.read(path) === contents) return;
      continue;
    }
    await adapter.write(path, contents);
    if (await adapter.read(path) !== contents) throw new Error('Metadata backup verification failed.');
    return;
  }
  throw new Error('Too many legacy metadata backups. Migration was not started.');
}
