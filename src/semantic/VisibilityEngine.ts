import { cleanTitleMarkup } from './InlineMath';
import type { GroupContainment } from './GroupHierarchy';
import { coordinateGroups, isEditingNode, isOrdinaryNode } from './GroupVisibility';
import type { SemanticLevel } from './SemanticLevel';
import type { RenderNode, RenderSnapshot } from '../canvas/CanvasRenderAdapter';
import type { SemanticStore } from './SemanticStore';
import type { ZoomMode } from './ZoomMode';

export type GroupDisplay = 'container' | 'summary' | 'hidden';
export interface NodeVisibility {
  readonly visible: boolean;
  readonly compact: boolean;
  readonly label: string;
  readonly groupDisplay: GroupDisplay | null;
}
export interface VisibilityPlan {
  readonly nodes: ReadonlyMap<string, NodeVisibility>;
  readonly hiddenEdges: ReadonlySet<string>;
}

function firstNonemptyLine(text: string): string {
  let start = 0;
  while (start < text.length) {
    const end = text.indexOf('\n', start);
    const line = text.slice(start, end < 0 ? text.length : end).trim();
    if (line) return line;
    if (end < 0) break;
    start = end + 1;
  }
  return '';
}

/** Extract title text while preserving inline math source for the renderer. */
export function conciseLabel(node: RenderNode, override?: string): string {
  let label = override?.trim() ?? '';
  if (!label && node.type === 'text') {
    label = firstNonemptyLine(node.text);
    label = cleanTitleMarkup(label.replace(/^#{1,6}\s+/, '').replace(/^[-*>]\s+/, ''));
  }
  if (!label && node.type === 'file') label = node.file.split('/').pop()?.replace(/\.md$/i, '') ?? '';
  if (!label && node.type === 'link') {
    try { label = new URL(node.url).hostname || node.url; } catch { label = node.url; }
  }
  label = label.replace(/\s+/g, ' ').trim() || 'Untitled';
  return label;
}

export function getVisibilityPlan(
  snapshot: RenderSnapshot, mode: ZoomMode, path: string, store: SemanticStore,
  containment?: GroupContainment,
): VisibilityPlan {
  const nodes = new Map<string, NodeVisibility>();
  const levels = new Map<string, SemanticLevel>();
  const limit = mode === 'DETAIL' ? 4 : mode === 'STRUCTURE' ? 3 : mode === 'OVERVIEW' ? 2 : 1;
  for (const node of snapshot.nodes) {
    const ordinary = isOrdinaryNode(node);
    const group = node.type === 'group';
    const editing = isEditingNode(node);
    const level = store.getLevel(path, node.id, node.type);
    levels.set(node.id, level);
    const visible = (!ordinary && !group) || editing || level <= limit;
    nodes.set(node.id, {
      visible,
      compact: ordinary && visible && mode !== 'DETAIL' && !editing,
      label: ordinary ? conciseLabel(node, store.getShortLabel(path, node.id)) : '',
      groupDisplay: !group ? null : !visible ? 'hidden'
        : mode !== 'DETAIL' && level === limit && !editing ? 'summary' : 'container',
    });
  }
  if (mode !== 'DETAIL') coordinateGroups(snapshot.nodes, nodes, levels, containment);
  const hiddenEdges = new Set<string>();
  for (const edge of snapshot.edges) {
    // Hide dangling links as well as links wholly inside hidden regions.
    if (nodes.get(edge.from)?.visible === false || nodes.get(edge.to)?.visible === false) hiddenEdges.add(edge.id);
  }
  return { nodes, hiddenEdges };
}
