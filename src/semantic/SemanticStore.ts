import { isDisplaySelection, type DisplaySelection } from './DisplaySelection';
import { defaultSemanticLevel, type SemanticLevel } from './SemanticLevel';
import { dictionary, emptyMetadata, parseMetadata, type StoredData } from './MetadataSchema';

interface Persistence {
  load(): Promise<unknown>;
  save(data: unknown): Promise<void>;
  backupLegacy?(data: unknown): Promise<void>;
}

/** Writes run in order; memory commits only after saveData succeeds. */
export class SemanticStore {
  private data = emptyMetadata();
  private ready = false;
  private currentRevision = 0;
  get revision(): number { return this.currentRevision; }

  getShortLabel(path: string, id: string): string | undefined {
    return this.data.canvases[path]?.nodes[id]?.shortLabel;
  }
  private pending: Promise<void> = Promise.resolve();
  constructor(private readonly persistence: Persistence) {}

  async load(): Promise<void> {
    this.ready = false;
    const original = await this.persistence.load();
    const { data, legacy } = parseMetadata(original);
    if (legacy) {
      if (!this.persistence.backupLegacy) throw new Error('Legacy metadata backup is unavailable.');
      await this.persistence.backupLegacy(original);
      try { await this.persistence.save(data); }
      catch (error) {
        // A failed write may have been partial. Attempt restoration; the verified backup remains.
        try { await this.persistence.save(original); }
        catch { throw new Error('Metadata migration and restoration failed. Restore the schema-v1 backup before retrying.'); }
        throw error;
      }
    }
    this.data = data;
    this.currentRevision++;
    this.ready = true;
  }

  getLevel(path: string, id: string, nodeType = 'text'): SemanticLevel {
    return this.data.canvases[path]?.nodes[id]?.level ?? defaultSemanticLevel(nodeType);
  }

  setLevel(path: string, id: string, level: SemanticLevel): Promise<void> {
    if (!path.endsWith('.canvas') || !id || ![1, 2, 3, 4].includes(level)) {
      return Promise.reject(new Error('Invalid semantic level target.'));
    }
    return this.change(next => {
      const canvas = next.canvases[path] ??= { nodes: dictionary() };
      canvas.nodes[id] = { ...canvas.nodes[id], level };
      return true;
    });
  }

  getDisplaySelection(path: string): DisplaySelection {
    return this.data.canvases[path]?.displayMode ?? 'AUTO';
  }

  setDisplaySelection(path: string, selection: DisplaySelection): Promise<void> {
    if (!path.endsWith('.canvas') || !isDisplaySelection(selection)) return Promise.reject(new Error('Invalid display mode.'));
    return this.change(next => {
      if ((next.canvases[path]?.displayMode ?? 'AUTO') === selection) return false;
      const canvas = next.canvases[path] ??= { nodes: dictionary() };
      if (selection === 'AUTO') delete canvas.displayMode;
      else canvas.displayMode = selection;
      return true;
    });
  }

  renamePath(oldPath: string, newPath: string): Promise<void> {
    return this.change(next => {
      const paths = Object.keys(next.canvases).filter(path => path === oldPath || path.startsWith(oldPath + '/'));
      for (const path of paths) {
        const destination = newPath + path.slice(oldPath.length);
        const metadata = next.canvases[path];
        if (!metadata) continue;
        if (next.canvases[destination] && destination !== path) {
          throw new Error('Semantic metadata already exists at destination.');
        }
        delete next.canvases[path];
        next.canvases[destination] = metadata;
      }
      return paths.length > 0;
    });
  }

  deletePath(path: string): Promise<void> {
    return this.change(next => {
      const paths = Object.keys(next.canvases).filter(key => key === path || key.startsWith(path + '/'));
      for (const key of paths) delete next.canvases[key];
      return paths.length > 0;
    });
  }

  private change(mutate: (data: StoredData) => boolean): Promise<void> {
    const operation = this.pending.then(async () => {
      if (!this.ready) throw new Error('Metadata is not ready for editing.');
      const next = parseMetadata(this.data).data;
      if (!mutate(next)) return;
      await this.persistence.save(next);
      this.data = next;
      this.currentRevision++;
    });
    // A failed write rejects its caller, but must not poison later writes.
    this.pending = operation.catch(() => {});
    return operation;
  }
}
