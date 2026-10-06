import { AdaptiveLabels, validLabelSize } from './AdaptiveLabels';
import type { RenderNode } from '../canvas/CanvasRenderAdapter';
import type { NodeVisibility } from '../semantic/VisibilityEngine';

export const HIDDEN_CLASS = 'smc-semantic-hidden';
export const COMPACT_CLASS = 'smc-semantic-compact';
export const LABEL_CLASS = 'smc-semantic-label';

function toggle(element: Element, name: string, enabled: boolean): void {
  if (element.classList.contains(name) !== enabled) element.classList.toggle(name, enabled);
}
interface LabelEntry { readonly overlay: HTMLElement; readonly title: HTMLElement }

export class NodeRenderer {
  private readonly managed = new Map<HTMLElement, LabelEntry | null>();

  constructor(private readonly labels: AdaptiveLabels) {}

  apply(nodes: readonly RenderNode[], plan: ReadonlyMap<string, NodeVisibility>): void {
    const current = new Set<HTMLElement>();
    for (const node of nodes) {
      const element = node.element;
      const state = plan.get(node.id);
      if (!element || !state) continue;
      current.add(element);
      let entry = this.managed.get(element) ?? null;
      const compact = state.compact && !!node.container && validLabelSize(node.width, node.height);
      toggle(element, HIDDEN_CLASS, !state.visible);
      toggle(element, COMPACT_CLASS, compact);
      if (compact && node.container) {
        if (!entry || entry.overlay.parentElement !== node.container || entry.title.parentElement !== entry.overlay) {
          this.releaseLabel(entry);
          const overlay = node.container.createDiv({ cls: LABEL_CLASS });
          entry = { overlay, title: overlay.createDiv({ cls: 'smc-fit-title' }) };
        }
        this.labels.prepare(entry.title, state.label, node.width, node.height, true, state.titleLines);
      } else {
        this.releaseLabel(entry);
        entry = null;
      }
      this.managed.set(element, entry);
    }
    for (const [element, entry] of this.managed) {
      if (!current.has(element)) this.release(element, entry);
    }
  }

  clear(): void {
    for (const [element, entry] of this.managed) this.release(element, entry);
  }

  private releaseLabel(entry: LabelEntry | null): void {
    if (!entry) return;
    this.labels.release(entry.title);
    entry.overlay.remove();
  }

  private release(element: HTMLElement, entry: LabelEntry | null): void {
    element.classList.remove(HIDDEN_CLASS, COMPACT_CLASS);
    this.releaseLabel(entry);
    this.managed.delete(element);
  }
}
