import { Notice, type Plugin } from 'obsidian';
import type { CanvasAdapter } from '../canvas/CanvasAdapter';
import { SEMANTIC_LEVELS } from './SemanticLevel';
import type { SemanticStore } from './SemanticStore';

export function registerSemanticMenu(plugin: Plugin, adapter: CanvasAdapter, store: SemanticStore): void {
  let active = true;
  plugin.register(() => { active = false; });
  const report = (error: unknown) => {
    console.error('[Semantic Map Canvas] Metadata operation failed.', error);
    if (active) new Notice('Semantic map canvas: metadata could not be saved. See console for details.');
  };
  plugin.registerEvent(adapter.onNodeMenu((menu, resolveTarget) => {
    const target = resolveTarget();
    if (!active || !target) return;
    const current = store.getLevel(target.path, target.id, target.type);
    for (const { level, label } of SEMANTIC_LEVELS) {
      menu.addItem(item => item.setTitle(label).setChecked(level === current).onClick(async () => {
        if (!active) return;
        // Resolve again: the Canvas may have been renamed while the menu was open.
        const latest = resolveTarget();
        if (!latest) return;
        try { await store.setLevel(latest.path, latest.id, level); }
        catch (error) { report(error); }
      }));
    }
  }));
  plugin.registerEvent(plugin.app.vault.on('rename', (file, oldPath) => {
    void store.renamePath(oldPath, file.path).catch(report);
  }));
  plugin.registerEvent(plugin.app.vault.on('delete', file => {
    void store.deletePath(file.path).catch(report);
  }));
}
