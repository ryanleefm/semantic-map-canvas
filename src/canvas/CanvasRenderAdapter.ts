import type { CanvasHandle } from './CanvasAdapter';
import type { InternalCanvas, InternalCanvasNode } from '../types/canvas-internal';

export interface RenderNode {
  readonly id: string;
  readonly type: string;
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  readonly text: string; readonly file: string; readonly url: string;
  readonly editing: boolean;
  readonly groupLabel: string;
  readonly nativeGroupLabel: HTMLElement | null;
  readonly groupLabelEditing: boolean;
  readonly element: HTMLElement | null;
  readonly container: HTMLElement | null;
}
export interface RenderEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly elements: readonly Element[];
}
export interface RenderOverlay {
  readonly element: Element;
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
}
export interface RenderSnapshot {
  readonly overlays?: readonly RenderOverlay[];
  readonly nodes: readonly RenderNode[];
  readonly edges: readonly RenderEdge[];
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Invalid Canvas render object.');
  return value as Record<string, unknown>;
}
function data(value: unknown): Record<string, unknown> {
  const object = record(value);
  if (typeof object.getData !== 'function') throw new Error('Canvas getData unavailable.');
  return record((object.getData as () => unknown).call(value));
}
function entries(value: unknown): unknown[] {
  const map = record(value);
  if (typeof map.values !== 'function') throw new Error('Canvas map unavailable.');
  return Array.from((map.values as () => IterableIterator<unknown>).call(value));
}
function element(value: unknown): Element | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Element;
  return candidate.nodeType === 1 && !!candidate.classList && !!candidate.ownerDocument ? candidate : null;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Invalid Canvas element ID.');
  return value;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid Canvas geometry.');
  return value;
}
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }

/** Read-only compatibility layer. No setData, viewport or history writes. */
export function readRenderSnapshot(handle: CanvasHandle): RenderSnapshot {
  const canvas = handle.identity as InternalCanvas;
  const nodes = entries(canvas.nodes).map(value => {
    const node = value as InternalCanvasNode;
    const saved = data(value);
    const nativeGroupLabel = saved.type === 'group' ? element(node.labelEl) as HTMLElement | null : null;
    return {
      id: id(saved.id), type: text(saved.type),
      x: number(saved.x), y: number(saved.y),
      width: number(saved.width), height: number(saved.height),
      text: text(saved.text), file: text(saved.file), url: text(saved.url),
      editing: node.isEditing === true,
      groupLabel: text(saved.label),
      nativeGroupLabel,
      groupLabelEditing: nativeGroupLabel?.getAttribute('contenteditable') === 'true',
      element: element(node.nodeEl) as HTMLElement | null,
      container: element(node.containerEl) as HTMLElement | null,
    };
  });
  const edges = entries(canvas.edges).map(value => {
    const edge = record(value);
    const saved = data(value);
    const label = edge.labelElement && typeof edge.labelElement === 'object'
      ? edge.labelElement as { wrapperEl?: unknown } : null;
    return {
      id: id(saved.id), from: id(saved.fromNode), to: id(saved.toNode),
      elements: [element(edge.lineGroupEl), element(edge.lineEndGroupEl), element(label?.wrapperEl)]
        .filter((part): part is Element => part !== null),
    };
  });
  const overlays: RenderOverlay[] = [];
  const raw = record(handle.identity);
  if (raw.nodeInteractionLayer && typeof raw.nodeInteractionLayer === 'object') {
    const layer = record(raw.nodeInteractionLayer);
    const el = element(layer.interactionEl);
    if (el && layer.target) overlays.push({ element: el, nodeIds: [id(data(layer.target).id)], edgeIds: [] });
  }
  if (raw.menu && typeof raw.menu === 'object' && raw.selection && typeof raw.selection === 'object') {
    const el = element(record(raw.menu).menuEl);
    const selected = entries(raw.selection).map(data);
    if (el && selected.length) {
      overlays.push({
        element: el,
        nodeIds: selected.filter(item => !('fromNode' in item)).map(item => id(item.id)),
        edgeIds: selected.filter(item => 'fromNode' in item).map(item => id(item.id)),
      });
    }
  }
  return { nodes, edges, overlays };
}
