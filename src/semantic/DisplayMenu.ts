import { Notice, type Menu, type Plugin } from 'obsidian';
import { DISPLAY_OPTIONS } from './DisplaySelection';
import type { SemanticStore } from './SemanticStore';

export function createDisplayMenu(plugin: Plugin, store: SemanticStore, refresh: () => void): (menu: Menu, resolve: () => string | null) => void {
  let active = true;
  plugin.register(() => { active = false; });
  return (menu, resolve) => {
    const path = resolve();
    if (!active || !path) return;
    const selected = store.getDisplaySelection(path);
    const populate = (target: Menu) => {
      for (const option of DISPLAY_OPTIONS) {
        target.addItem(item => item.setTitle(option.label).setChecked(selected === option.value).onClick(async () => {
          const latest = resolve();
          if (!active || !latest) return;
          try {
            await store.setDisplaySelection(latest, option.value);
            if (active) refresh();
          } catch (error) {
            console.error('[Semantic Map Canvas] Display mode could not be saved.', error);
            if (active) new Notice('Semantic map canvas: display mode could not be saved. Previous selection kept.');
          }
        }));
      }
    };
    menu.addItem(item => {
      item.setTitle('Display mode').setIcon('layers');
      const internal = item as typeof item & { setSubmenu?: () => Menu };
      if (typeof internal.setSubmenu === 'function') populate(internal.setSubmenu());
      else { item.setDisabled(true); populate(menu); }
    });
  };
}
