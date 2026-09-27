import type { RenderNode } from '../canvas/CanvasRenderAdapter';
import type { SemanticLevel } from './SemanticLevel';
import type { NodeVisibility } from './VisibilityEngine';
import { getGroupContainment, type GroupContainment } from './GroupHierarchy';

export function isOrdinaryNode(node: RenderNode): boolean {
  return ['text', 'file', 'link'].includes(node.type);
}
export function isEditingNode(node: RenderNode): boolean {
  return node.editing || (node.type === 'group' && node.groupLabelEditing);
}

/** Resolve summaries from inner to outer; a hidden container never hides its children by itself. */
export function coordinateGroups(
  renderNodes: readonly RenderNode[], states: Map<string, NodeVisibility>, levels: ReadonlyMap<string, SemanticLevel>,
  containment?: GroupContainment,
): void {
  const { innerFirst, descendants } = containment ?? getGroupContainment(renderNodes);
  for (const group of innerFirst) {
    const state = states.get(group.id);
    if (state?.groupDisplay !== 'summary') continue;
    const level = levels.get(group.id)!;
    const children = descendants.get(group.id) ?? [];
    const protectedContent = children.some(child => states.get(child.id)?.visible
      && (isEditingNode(child) || levels.get(child.id)! <= level
        || (!isOrdinaryNode(child) && child.type !== 'group')));
    if (protectedContent) {
      states.set(group.id, { ...state, groupDisplay: 'container' });
      continue;
    }
    // Only a visible summary may suppress less important contents.
    for (const child of children) {
      const childState = states.get(child.id);
      if (childState?.visible && levels.get(child.id)! > level && !isEditingNode(child)) {
        states.set(child.id, { ...childState, visible: false, compact: false,
          groupDisplay: child.type === 'group' ? 'hidden' : null });
      }
    }
  }
}
