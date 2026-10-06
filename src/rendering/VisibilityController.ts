import { AdaptiveLabels } from './AdaptiveLabels';
import { GroupContainmentCache } from '../semantic/GroupHierarchy';
import { getDisplayMode, type DisplayModeState } from '../semantic/DisplayMode';
import { GroupOverviewRenderer } from './GroupOverviewRenderer';
import { OverlayRenderer } from './OverlayRenderer';
import { readRenderSnapshot } from '../canvas/CanvasRenderAdapter';
import type { CanvasSnapshot } from '../canvas/CanvasAdapter';
import { getVisibilityPlan } from '../semantic/VisibilityEngine';
import type { SemanticStore } from '../semantic/SemanticStore';
import type { ZoomMode } from '../semantic/ZoomMode';
import { NodeRenderer } from './NodeRenderer';
import { EdgeRenderer } from './EdgeRenderer';

export class VisibilityController {
  private readonly labels = new AdaptiveLabels();
  private readonly nodes = new NodeRenderer(this.labels);
  private readonly containment = new GroupContainmentCache();
  private readonly groups = new GroupOverviewRenderer(this.labels);
  private readonly edges = new EdgeRenderer();
  private readonly overlays = new OverlayRenderer();
  private canvas: CanvasSnapshot | null = null;
  private rawMode: ZoomMode | null = null;
  private displayState: DisplayModeState | null = null;
  private revision = -1;
  private lastScan = -Infinity;
  private warned = false;
  private stopped = false;
  private suspended = false;

  constructor(private readonly store: SemanticStore) {}

  getDisplayState(): DisplayModeState | null { return this.displayState; }

  /** Explicit diagnostics may be requested even when the state has not changed. */
  logDiagnostics(): void {
    console.debug('[Semantic Map Canvas] Semantic display',
      this.displayState ?? { status: this.suspended ? 'paused' : 'unavailable' });
  }

  /** Escape hatch for editing nodes hidden by the current semantic mode. */
  toggleSuspended(): boolean {
    this.suspended = !this.suspended;
    this.clear();
    return this.suspended;
  }

  update(snapshot: CanvasSnapshot | null, rawMode: ZoomMode | null, now = performance.now()): void {
    if (this.stopped) return;
    if (!snapshot?.filePath || !rawMode || this.suspended) { this.clear(); return; }
    const changedCanvas = snapshot.identity !== this.canvas?.identity || snapshot.filePath !== this.canvas?.filePath;
    if (changedCanvas) this.clear();
    const changed = changedCanvas || rawMode !== this.rawMode || this.revision !== this.store.revision
      || snapshot.nodeCount !== this.canvas?.nodeCount || snapshot.edgeCount !== this.canvas?.edgeCount;
    this.canvas = snapshot;
    this.rawMode = rawMode;
    this.revision = this.store.revision;
    try {
      // Catch same-count replacement and lazy loading even when effective mode is DETAIL.
      if (!changed && now - this.lastScan < 250) { this.labels.updateZoom(snapshot.zoom); return; }
      this.lastScan = now;
      const render = readRenderSnapshot(snapshot);
      const next = getDisplayMode(render.nodes, rawMode, snapshot.filePath, this.store);
      const stateChanged = next.selection !== this.displayState?.selection || next.rawMode !== this.displayState?.rawMode
        || next.effectiveMode !== this.displayState?.effectiveMode || next.highestLevel !== this.displayState?.highestLevel;
      this.displayState = next;
      if (stateChanged) this.logDiagnostics();
      if (next.effectiveMode === 'DETAIL') {
        this.clearRendering();
      } else {
        const plan = getVisibilityPlan(render, next.effectiveMode, snapshot.filePath, this.store, this.containment.get(render.nodes));
        this.nodes.apply(render.nodes, plan.nodes);
        this.groups.apply(render.nodes.filter(node => plan.nodes.get(node.id)?.groupDisplay === 'summary'), id => this.store.getTitleLines(snapshot.filePath!, id));
        this.labels.flush(snapshot.zoom);
        this.edges.apply(render.edges, plan.hiddenEdges);
        this.overlays.apply(render.overlays ?? [], plan);
      }
      this.warned = false;
    } catch (error) {
      this.containment.clear();
      this.clearRendering();
      this.displayState = null;
      if (!this.warned) console.warn('[Semantic Map Canvas] Visibility unavailable; restored native rendering.', error);
      this.warned = true;
    }
  }

  stop(): void { this.stopped = true; this.clear(); }

  private clearRendering(): void {
    this.groups.clear(); this.nodes.clear(); this.edges.clear(); this.overlays.clear();
  }

  private clear(): void {
    this.containment.clear();
    this.clearRendering();
    this.canvas = null; this.rawMode = null; this.displayState = null; this.lastScan = -Infinity;
  }
}
