import type { RenderOverlay } from '../canvas/CanvasRenderAdapter';
import type { VisibilityPlan } from '../semantic/VisibilityEngine';
import { HIDDEN_CLASS } from './NodeRenderer';

export class OverlayRenderer {
  private managed = new Set<Element>();
  apply(overlays: readonly RenderOverlay[], plan: VisibilityPlan): void {
    const hidden = new Set<Element>();
    for (const overlay of overlays) {
      if (overlay.nodeIds.length + overlay.edgeIds.length > 0
        && overlay.nodeIds.every(id => plan.nodes.get(id)?.visible === false)
        && overlay.edgeIds.every(id => plan.hiddenEdges.has(id))) hidden.add(overlay.element);
    }
    for (const element of this.managed) if (!hidden.has(element)) element.classList.remove(HIDDEN_CLASS);
    for (const element of hidden) if (!element.classList.contains(HIDDEN_CLASS)) element.classList.add(HIDDEN_CLASS);
    this.managed = hidden;
  }
  clear(): void {
    for (const element of this.managed) element.classList.remove(HIDDEN_CLASS);
    this.managed.clear();
  }
}
