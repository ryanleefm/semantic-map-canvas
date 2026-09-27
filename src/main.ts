import { backupLegacyMetadata } from './semantic/MetadataBackup';
import { VisibilityController } from './rendering/VisibilityController';
import { SemanticStore } from './semantic/SemanticStore';
import { registerSemanticMenu } from './semantic/SemanticMenu';
import { Notice, Plugin } from 'obsidian';
import { CanvasAdapter } from './canvas/CanvasAdapter';
import { CanvasObserver } from './canvas/CanvasObserver';

export default class SemanticMapCanvasPlugin extends Plugin {
  async onload(): Promise<void> {
    const adapter = new CanvasAdapter(this.app);
    let visibility: VisibilityController | null = null;
    const observer = new CanvasObserver(adapter, (snapshot, mode) => visibility?.update(snapshot, mode));
    let unloaded = false;
    this.register(() => {
      unloaded = true;
      observer.stop();
      visibility?.stop();
    });
    // onLayoutReady may run after disable; the guard prevents a late timer leak.
    this.app.workspace.onLayoutReady(() => {
      if (!unloaded) observer.start();
    });
    this.addCommand({
      id: 'log-canvas-diagnostics',
      name: 'Log active canvas diagnostics',
      callback: () => { observer.logSnapshot(); visibility?.logDiagnostics(); },
    });
    const store = new SemanticStore({
      load: () => this.loadData() as Promise<unknown>,
      save: data => this.saveData(data),
      backupLegacy: data => {
        const directory = this.manifest.dir;
        if (!directory) throw new Error('Plugin directory unavailable; migration was not started.');
        return backupLegacyMetadata(this.app.vault.adapter, directory, data);
      },
    });
    try {
      await store.load();
      if (!unloaded) {
        registerSemanticMenu(this, adapter, store);
        visibility = new VisibilityController(store);
        this.addCommand({
          id: 'toggle-semantic-visibility',
          name: 'Toggle semantic visibility',
          callback: () => {
            const suspended = visibility?.toggleSuspended();
            new Notice(suspended ? 'Semantic visibility paused.' : 'Semantic visibility resumed.');
          },
        });
      }
    } catch (error) {
      console.error('[Semantic Map Canvas] Could not load metadata; editing disabled.', error);
      if (!unloaded) new Notice('Semantic map canvas: metadata could not be loaded or migrated. Level editing is disabled. Check the console; any migration backup is in the plugin folder.');
    }
  }
}
