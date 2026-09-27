import type { RenderNode } from '../canvas/CanvasRenderAdapter';

/** Full geometric containment. Identical group rectangles are peers, never a cycle. */
export function containsNode(group: RenderNode, node: RenderNode): boolean {
  if (group.id === node.id || group.width <= 0 || group.height <= 0 || node.width < 0 || node.height < 0) return false;
  const contains = node.x >= group.x && node.y >= group.y
    && node.x + node.width <= group.x + group.width
    && node.y + node.height <= group.y + group.height;
  if (!contains || node.type !== 'group') return contains;
  return node.x > group.x || node.y > group.y
    || node.x + node.width < group.x + group.width
    || node.y + node.height < group.y + group.height;
}

export interface GroupContainment {
  readonly innerFirst: readonly RenderNode[];
  readonly descendants: ReadonlyMap<string, readonly RenderNode[]>;
}

/** Keep all containing regions: a protected node shared by overlapping groups protects both. */
export function getGroupContainment(nodes: readonly RenderNode[]): GroupContainment {
  const groups = nodes.filter(node => node.type === 'group');
  // Containment implies nondecreasing width and height. Avoid area multiplication overflow.
  groups.sort((a, b) => a.width - b.width || a.height - b.height || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const descendants = new Map<string, readonly RenderNode[]>();
  for (const group of groups) descendants.set(group.id, nodes.filter(node => containsNode(group, node)));
  return { innerFirst: groups, descendants };
}

interface Geometry {
  readonly id: string; readonly type: string;
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
}

/** Cache only geometry/IDs, never mutable editing state or DOM references. */
export class GroupContainmentCache {
  private geometry: readonly Geometry[] | null = null;
  private order: readonly string[] = [];
  private children = new Map<string, readonly string[]>();

  get(nodes: readonly RenderNode[]): GroupContainment {
    const unchanged = this.geometry?.length === nodes.length && nodes.every((node, index) => {
      const previous = this.geometry![index]!;
      return node.id === previous.id && node.type === previous.type && node.x === previous.x
        && node.y === previous.y && node.width === previous.width && node.height === previous.height;
    });
    if (!unchanged) {
      const result = getGroupContainment(nodes);
      this.geometry = nodes.map(({ id, type, x, y, width, height }) => ({ id, type, x, y, width, height }));
      this.order = result.innerFirst.map(node => node.id);
      this.children = new Map([...result.descendants].map(([id, descendants]) => [id, descendants.map(node => node.id)]));
      return result;
    }
    const current = new Map(nodes.map(node => [node.id, node]));
    return {
      innerFirst: this.order.map(id => current.get(id)!),
      descendants: new Map([...this.children].map(([id, descendants]) => [id, descendants.map(child => current.get(child)!)])),
    };
  }

  clear(): void {
    this.geometry = null;
    this.order = [];
    this.children.clear();
  }
}
