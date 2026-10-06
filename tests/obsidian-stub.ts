export class TextFileView {}
export class Notice {
  static messages: string[] = [];
  constructor(message: string) { Notice.messages.push(message); }
}
export class TestEvents {
  listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  on(name: string, callback: (...args: unknown[]) => void) {
    const callbacks = this.listeners.get(name) ?? new Set();
    this.listeners.set(name, callbacks); callbacks.add(callback);
    return { dispose: () => callbacks.delete(callback) };
  }
  emit(name: string, ...args: unknown[]): void {
    for (const callback of this.listeners.get(name) ?? []) callback(...args);
  }
}
export class Menu {
  items: MenuItem[] = [];
  addItem(callback: (item: MenuItem) => unknown): this {
    const item = new MenuItem(); callback(item); this.items.push(item); return this;
  }
}
export class MenuItem {
  title = ''; checked = false; disabled = false; submenu?: Menu;
  callback: () => unknown = () => {};
  setTitle(title: string): this { this.title = title; return this; }
  setIcon(): this { return this; }
  setChecked(value: boolean): this { this.checked = value; return this; }
  setDisabled(value: boolean): this { this.disabled = value; return this; }
  setSubmenu(): Menu { return this.submenu = new Menu(); }
  onClick(callback: () => unknown): this { this.callback = callback; return this; }
}
export class Plugin {
  app: unknown;
  cleanups: Array<() => void> = [];
  commands: unknown[] = [];
  register(cleanup: () => void): void { this.cleanups.push(cleanup); }
  registerEvent(ref: { dispose: () => void }): void { this.register(() => ref.dispose()); }
  addCommand(command: unknown): void { this.commands.push(command); }
  async loadData(): Promise<unknown> { return null; }
  async saveData(): Promise<void> {}
}

export function normalizePath(path: string): string { return path.replaceAll('\\', '/').replace(/\/+/g, '/'); }

export async function loadMathJax(): Promise<void> {}
export async function finishRenderMath(): Promise<void> {}
export function renderMath(): HTMLElement { throw new Error("Math rendering requires Obsidian"); }
