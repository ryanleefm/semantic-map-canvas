import type { RenderEdge } from '../canvas/CanvasRenderAdapter';
import { HIDDEN_CLASS } from './NodeRenderer';

export class EdgeRenderer {
  private managed = new Set<Element>();

  apply(edges: readonly RenderEdge[], hidden: ReadonlySet<string>): void {
    const next = new Set<Element>();
    for (const edge of edges) {
      for (const element of edge.elements) {
        const shouldHide = hidden.has(edge.id);
        if (element.classList.contains(HIDDEN_CLASS) !== shouldHide) element.classList.toggle(HIDDEN_CLASS, shouldHide);
        if (shouldHide) next.add(element);
      }
    }
    for (const element of this.managed) {
      if (!next.has(element)) element.classList.remove(HIDDEN_CLASS);
    }
    this.managed = next;
  }

  clear(): void {
    for (const element of this.managed) element.classList.remove(HIDDEN_CLASS);
    this.managed.clear();
  }
}
