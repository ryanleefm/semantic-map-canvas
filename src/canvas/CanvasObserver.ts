import { CanvasAdapter, type CanvasSnapshot } from './CanvasAdapter';
import { getZoomMode, type ZoomMode } from '../semantic/ZoomMode';

/** Owns mode state and logging, with no knowledge of Canvas internals. */
export class CanvasObserver {
  private dispose: (() => void) | null = null;
  private current: CanvasSnapshot | null = null;
  private mode: ZoomMode | null = null;

  constructor(
    private readonly adapter: CanvasAdapter,
    private readonly onSample?: (snapshot: CanvasSnapshot | null, mode: ZoomMode | null) => void,
  ) {}

  start(): void {
    if (this.dispose) return;
    this.dispose = this.adapter.onViewportChanged(snapshot => this.update(snapshot), !!this.onSample);
  }

  stop(): void {
    this.dispose?.();
    this.dispose = null;
    this.current = null;
    this.mode = null;
  }

  logSnapshot(): void {
    const snapshot = this.adapter.getSnapshot();
    if (!snapshot) {
      console.debug('[Semantic Map Canvas] No supported active Canvas.');
      return;
    }
    this.update(snapshot);
    this.logRuntime(snapshot);
  }

  private update(snapshot: CanvasSnapshot | null): void {
    if (!snapshot) {
      this.current = null;
      this.mode = null;
      this.onSample?.(null, null);
      return;
    }
    const changedCanvas = snapshot.identity !== this.current?.identity
      || snapshot.filePath !== this.current?.filePath;
    if (changedCanvas) {
      this.mode = null;
      this.logRuntime(snapshot);
    }
    const nextMode = getZoomMode(snapshot.zoom, this.mode);
    if (nextMode !== this.mode) {
      console.debug(`[Semantic Map Canvas]\nZoom mode: ${this.mode ?? 'INITIAL'} -> ${nextMode}\nzoom: ${snapshot.zoom.toFixed(4)}`);
      this.mode = nextMode;
    }
    this.current = snapshot;
    this.onSample?.(snapshot, this.mode);
  }

  private logRuntime(snapshot: CanvasSnapshot): void {
    // Deliberately omit note contents, paths and live mutable Canvas objects.
    console.debug('[Semantic Map Canvas] Active Canvas', {
      zoom: snapshot.zoom,
      rawZoom: snapshot.rawZoom,
      nodes: snapshot.nodeCount,
      edges: snapshot.edgeCount,
    });
  }
}
