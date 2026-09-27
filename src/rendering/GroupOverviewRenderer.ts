import { AdaptiveLabels, validLabelSize } from './AdaptiveLabels';
import type { RenderNode } from '../canvas/CanvasRenderAdapter';

export const GROUP_CLASS = 'smc-group-overview';
export const GROUP_LABEL_CLASS = 'smc-group-overview-label';
export const GROUP_TITLE_CLASS = 'smc-group-overview-title';
export const NATIVE_GROUP_LABEL_CLASS = 'smc-group-native-label-hidden';

interface GroupEntry {
  readonly overlay: HTMLElement;
  readonly title: HTMLElement;
  nativeLabel: HTMLElement | null;
}

/** Owns only injected DOM/classes. Native group data, styles and labels stay intact. */
export class GroupOverviewRenderer {
  private readonly managed = new Map<HTMLElement, GroupEntry>();

  constructor(private readonly labels: AdaptiveLabels) {}

  apply(nodes: readonly RenderNode[]): void {
    const current = new Set<HTMLElement>();
    for (const node of nodes) {
      const element = node.element;
      if (node.type !== 'group' || !element || node.editing || node.groupLabelEditing
        || !validLabelSize(node.width, node.height)) continue;
      current.add(element);
      let entry = this.managed.get(element);
      if (entry && (entry.overlay.parentElement !== element || entry.title.parentElement !== entry.overlay)) {
        this.release(element, entry);
        entry = undefined;
      }
      if (!entry) {
        const overlay = element.createDiv({ cls: GROUP_LABEL_CLASS });
        const title = overlay.createDiv({ cls: GROUP_TITLE_CLASS + ' smc-fit-title' });
        entry = { overlay, title, nativeLabel: null };
        this.managed.set(element, entry);
      }
      if (entry.nativeLabel !== node.nativeGroupLabel) {
        entry.nativeLabel?.classList.remove(NATIVE_GROUP_LABEL_CLASS);
        entry.nativeLabel = node.nativeGroupLabel;
      }
      if (!element.classList.contains(GROUP_CLASS)) element.classList.add(GROUP_CLASS);
      if (entry.nativeLabel && !entry.nativeLabel.classList.contains(NATIVE_GROUP_LABEL_CLASS)) {
        entry.nativeLabel.classList.add(NATIVE_GROUP_LABEL_CLASS);
      }
      const text = node.groupLabel.trim() || 'Untitled group';
      this.labels.prepare(entry.title, text, node.width, node.height);
    }
    for (const [element, entry] of this.managed) {
      if (!current.has(element)) this.release(element, entry);
    }
  }

  clear(): void {
    for (const [element, entry] of this.managed) this.release(element, entry);
  }

  private release(element: HTMLElement, entry: GroupEntry): void {
    entry.nativeLabel?.classList.remove(NATIVE_GROUP_LABEL_CLASS);
    element.classList.remove(GROUP_CLASS);
    this.labels.release(entry.title);
    entry.overlay.remove();
    this.managed.delete(element);
  }
}
