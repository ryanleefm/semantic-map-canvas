import type { RenderNode } from '../canvas/CanvasRenderAdapter';
import type { SemanticLevel } from './SemanticLevel';
import type { SemanticStore } from './SemanticStore';
import type { ZoomMode } from './ZoomMode';

export interface DisplayModeState {
  readonly rawMode: ZoomMode;
  readonly effectiveMode: ZoomMode;
  readonly highestLevel: SemanticLevel | null;
}
const MODE_LEVEL: Record<ZoomMode, SemanticLevel> = { MAP: 1, OVERVIEW: 2, STRUCTURE: 3, DETAIL: 4 };
const LEVEL_MODE: Record<SemanticLevel, ZoomMode> = { 1: 'MAP', 2: 'OVERVIEW', 3: 'STRUCTURE', 4: 'DETAIL' };

/** Scan live node IDs, not stored records or mounted DOM. Never feeds back into zoom hysteresis. */
export function getDisplayMode(
  nodes: readonly RenderNode[], rawMode: ZoomMode, path: string, store: SemanticStore,
): DisplayModeState {
  let highestLevel: SemanticLevel | null = null;
  for (const node of nodes) {
    if (!['text', 'file', 'link', 'group'].includes(node.type)) continue;
    const level = store.getLevel(path, node.id, node.type);
    if (highestLevel === null || level < highestLevel) highestLevel = level;
    if (highestLevel === 1) break;
  }
  const effectiveLevel = Math.max(MODE_LEVEL[rawMode], highestLevel ?? 4) as SemanticLevel;
  return { rawMode, highestLevel, effectiveMode: LEVEL_MODE[effectiveLevel] };
}
