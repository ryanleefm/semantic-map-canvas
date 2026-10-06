import { TITLE_LINES, titleLinesLabel } from './TitleLines';
import { Notice, type Plugin } from 'obsidian';
import type { CanvasAdapter } from '../canvas/CanvasAdapter';
import { SEMANTIC_LEVELS } from './SemanticLevel';
import type { SemanticStore } from './SemanticStore';

export function registerSemanticMenu(plugin: Plugin, adapter: CanvasAdapter, store: SemanticStore, refresh: () => void = () => {}): void {
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
  plugin.registerEvent(adapter.onNodeMenu((menu, resolveTarget) => {
    const target = resolveTarget();
    if (!active || !target) return;
    const current = store.getTitleLines(target.path, target.id);
    for (const lines of TITLE_LINES) {
      menu.addItem(item => item.setTitle(titleLinesLabel(lines)).setChecked(lines === current).onClick(async () => {
        if (!active) return;
        const latest = resolveTarget();
        if (!latest) return;
        try {
          await store.setTitleLines(latest.path, latest.id, lines, latest.type);
          if (active) refresh();
        } catch (error) { report(error); }
      }));
    }
  }, 'Max title lines', 'align-justify'));
  plugin.registerEvent(plugin.app.vault.on('rename', (file, oldPath) => {
    void store.renamePath(oldPath, file.path).catch(report);
  }));
  plugin.registerEvent(plugin.app.vault.on('delete', file => {
    void store.deletePath(file.path).catch(report);
  }));
}
