import { TextFileView, type App, type Events, type EventRef, type Menu } from 'obsidian';
import type { InternalCanvas, InternalCanvasView, InternalCanvasNode } from '../types/canvas-internal';

/** Opaque identity. Consumers must not read Canvas internals through it. */
export interface SemanticNodeTarget { readonly path: string; readonly id: string; readonly type: string }

export interface CanvasHandle {
  readonly identity: object;
  readonly filePath: string | null;
}

export interface CanvasSnapshot extends CanvasHandle {
  readonly zoom: number;
  readonly rawZoom: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

interface ReadableMap {
  readonly size: number;
  values(): IterableIterator<unknown>;
  get(key: string): unknown;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

// Structural validation works for maps belonging to pop-out windows too.
function isReadableMap(value: unknown): value is ReadableMap {
  if (!isObject(value)) return false;
  const map = value as Partial<ReadableMap>;
  return typeof map.size === 'number' && Number.isSafeInteger(map.size)
    && map.size >= 0 && typeof map.values === 'function' && typeof map.get === 'function';
}

/** The sole compatibility boundary for all undocumented Canvas access. */
export class CanvasAdapter {
  private warned = false;

  constructor(private readonly app: App) {}


  /** Native but undocumented event; no prototype patch is necessary. */
  onNodeMenu(listener: (menu: Menu, resolveTarget: () => SemanticNodeTarget | null) => void, title = 'Semantic level', icon = 'layers'): EventRef {
    return (this.app.workspace as Events).on('canvas:node-menu', (menu: unknown, node: unknown) => {
      const resolveTarget = () => this.getSemanticTarget(node);
      if (!resolveTarget() || !isObject(menu) || typeof (menu as Menu).addItem !== 'function') return;
      const parent = menu as Menu;
      parent.addItem(item => {
        item.setTitle(title).setIcon(icon);
        // setSubmenu exists in desktop 1.9.14 but is absent from public typings.
        const internalItem = item as typeof item & { setSubmenu?: () => Menu };
        if (typeof internalItem.setSubmenu === 'function') {
          listener(internalItem.setSubmenu(), resolveTarget);
        } else {
          item.setDisabled(true);
          listener(parent, resolveTarget);
        }
      });
    });
  }

  private getSemanticTarget(value: unknown): SemanticNodeTarget | null {
    try {
      if (!isObject(value)) return null;
      const node = value as InternalCanvasNode;
      if (typeof node.getData !== 'function' || !isObject(node.canvas)) return null;
      const data: unknown = node.getData();
      if (!isObject(data)) return null;
      const { id, type } = data as { id?: unknown; type?: unknown };
      if (typeof id !== 'string' || !id || !['text', 'file', 'link', 'group'].includes(String(type))) return null;
      const canvas = node.canvas as InternalCanvas;
      if (!isReadableMap(canvas.nodes) || canvas.nodes.get(id) !== node) return null;
      const view = canvas.view as { file?: { path?: unknown } } | undefined;
      const path = view?.file?.path;
      if (typeof path !== 'string' || !path.endsWith('.canvas')
        || !this.app.vault.getAbstractFileByPath(path)) return null;
      return { path, id, type: String(type) };
    } catch (error) {
      console.warn('[Semantic Map Canvas] Node menu unavailable.', error);
      return null;
    }
  }

  getActiveCanvas(): CanvasHandle | null {
    const view = this.app.workspace.getActiveViewOfType(TextFileView);
    if (view?.getViewType() !== 'canvas') return null;
    const canvas = (view as unknown as InternalCanvasView).canvas;
    // A deferred Canvas view may not have created its runtime yet. Retry later.
    if (canvas === undefined || canvas === null) return null;
    if (!isObject(canvas)) throw new Error('Canvas instance is not an object.');
    return { identity: canvas, filePath: view.file?.path ?? null };
  }

  getZoom(canvas: CanvasHandle): number | null {
    const raw = (canvas.identity as InternalCanvas).zoom;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    const scale = 2 ** raw;
    return Number.isFinite(scale) && scale > 0 ? scale : null;
  }

  getNodes(canvas: CanvasHandle): readonly unknown[] {
    const nodes = (canvas.identity as InternalCanvas).nodes;
    return isReadableMap(nodes) ? Array.from(nodes.values()) : [];
  }

  getEdges(canvas: CanvasHandle): readonly unknown[] {
    const edges = (canvas.identity as InternalCanvas).edges;
    return isReadableMap(edges) ? Array.from(edges.values()) : [];
  }

  getSnapshot(): CanvasSnapshot | null {
    try {
      const handle = this.getActiveCanvas();
      if (!handle) return null;
      const canvas = handle.identity as InternalCanvas;
      const zoom = this.getZoom(handle);
      const rawZoom = canvas.zoom;
      const nodes = canvas.nodes;
      const edges = canvas.edges;
      if (zoom === null || typeof rawZoom !== 'number'
        || !isReadableMap(nodes) || !isReadableMap(edges)) {
        throw new Error('Canvas zoom/nodes/edges have an unsupported shape.');
      }
      this.warned = false;
      // O(1): polling never enumerates nodes, edges or DOM.
      return { ...handle, zoom, rawZoom, nodeCount: nodes.size, edgeCount: edges.size };
    } catch (error) {
      if (!this.warned) {
        console.warn('[Semantic Map Canvas] Canvas unavailable; will retry safely.', error);
        this.warned = true;
      }
      return null;
    }
  }

  /**
   * Read-only sampling, not an Obsidian native viewport event. Covers wheel,
   * pinch, keyboard, fit-to-view, animation and active file/leaf replacement.
   * At most 10Hz; no monkey patch, DOM selector or third-party dependency.
   * Phase 3 needs scale changes only; panning alone does not notify.
   */
  onViewportChanged(listener: (snapshot: CanvasSnapshot | null) => void, emitUnchanged = false): () => void {
    let previous: CanvasSnapshot | null | undefined;
    let stopped = false;
    const sample = () => {
      if (stopped) return;
      const next = this.getSnapshot();
      if (!emitUnchanged && previous !== undefined && next?.identity === previous?.identity
        && next?.filePath === previous?.filePath && next?.zoom === previous?.zoom
        && next?.nodeCount === previous?.nodeCount && next?.edgeCount === previous?.edgeCount) return;
      previous = next;
      listener(next);
    };
    const timer = window.setInterval(sample, 100);
    sample();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      previous = undefined;
    };
  }
}
