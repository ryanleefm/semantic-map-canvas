import type { App, Menu } from 'obsidian';
import type { CanvasHandle } from './CanvasAdapter';

type MenuMethod = (this: object, ...args: unknown[]) => unknown;
interface MenuCanvas { showQuickSettingsMenu?: MenuMethod; view?: { file?: { path?: unknown } } }

/** Scoped to the active Canvas instance: no global Menu/prototype or DOM hooks. */
export class CanvasMenuBridge {
  private identity: object | null = null;
  private dispose: (() => void) | null = null;
  private readonly seen = new WeakSet<object>();
  constructor(private readonly app: App, private readonly add: (menu: Menu, resolve: () => string | null) => void) {}

  bind(handle: CanvasHandle | null): void {
    if (handle?.identity === this.identity) return;
    this.clear();
    if (!handle) return;
    const canvas = handle.identity as MenuCanvas;
    const original = canvas.showQuickSettingsMenu;
    if (typeof original !== 'function') return;
    const descriptor = Object.getOwnPropertyDescriptor(canvas, 'showQuickSettingsMenu');
    let append: ((menu: unknown) => void) | null = menu => {
      if (!menu || typeof menu !== 'object' || typeof (menu as Menu).addItem !== 'function' || this.seen.has(menu)) return;
      const resolve = () => {
        if (this.identity !== canvas) return null;
        const path = canvas.view?.file?.path;
        return typeof path === 'string' && path.endsWith('.canvas') && this.app.vault.getAbstractFileByPath(path) ? path : null;
      };
      if (!resolve()) return;
      this.seen.add(menu);
      this.add(menu as Menu, resolve);
    };
    const wrapped: MenuMethod = function (...args) {
      const result = original.apply(this, args);
      if (this === canvas && append) {
        try { append(args[0]); }
        catch (error) { console.warn('[Semantic Map Canvas] Display menu unavailable.', error); }
      }
      return result;
    };
    try {
      Object.defineProperty(canvas, 'showQuickSettingsMenu', { configurable: true, writable: true, value: wrapped });
    } catch { return; }
    this.identity = canvas;
    this.dispose = () => {
      append = null; // A later third-party wrapper may still call ours.
      if (canvas.showQuickSettingsMenu !== wrapped) return;
      if (descriptor) Object.defineProperty(canvas, 'showQuickSettingsMenu', descriptor);
      else delete canvas.showQuickSettingsMenu;
    };
  }

  clear(): void {
    this.dispose?.();
    this.dispose = null;
    this.identity = null;
  }
}
