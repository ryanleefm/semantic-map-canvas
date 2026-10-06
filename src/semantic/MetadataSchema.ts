import { isTitleLines } from './TitleLines';
import { isDisplaySelection, type DisplaySelection } from './DisplaySelection';
import type { SemanticLevel, SemanticNodeMetadata } from './SemanticLevel';

interface CanvasMetadata { nodes: Record<string, SemanticNodeMetadata>; displayMode?: DisplaySelection }
export interface StoredData { schemaVersion: 2; canvases: Record<string, CanvasMetadata> }

export function dictionary<T>(): Record<string, T> { return Object.create(null) as Record<string, T>; }
export function emptyMetadata(): StoredData { return { schemaVersion: 2, canvases: dictionary() }; }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the entire document before backing up or writing a migration. */
export function parseMetadata(value: unknown): { data: StoredData; legacy: boolean } {
  if (value === null || value === undefined) return { data: emptyMetadata(), legacy: false };
  if (!record(value) || ![1, 2].includes(value.schemaVersion as number) || !record(value.canvases)) {
    throw new Error('Unsupported or invalid semantic metadata.');
  }
  const legacy = value.schemaVersion === 1;
  const allowed = legacy ? [1, 2, 3] : [1, 2, 3, 4];
  const data = emptyMetadata();
  for (const [path, canvas] of Object.entries(value.canvases)) {
    if (!record(canvas) || !record(canvas.nodes)) throw new Error('Invalid canvas metadata.');
    const nodes = dictionary<SemanticNodeMetadata>();
    for (const [id, node] of Object.entries(canvas.nodes)) {
      if (!record(node) || !allowed.includes(node.level as number)
        || (node.shortLabel !== undefined && typeof node.shortLabel !== 'string')) {
        throw new Error('Invalid node metadata.');
      }
      nodes[id] = { level: ((node.level as number) + (legacy ? 1 : 0)) as SemanticLevel };
      if (isTitleLines(node.titleLines) && node.titleLines !== 'AUTO') nodes[id].titleLines = node.titleLines;
      if (typeof node.shortLabel === 'string') nodes[id].shortLabel = node.shortLabel;
    }
    data.canvases[path] = { nodes };
    if (isDisplaySelection(canvas.displayMode) && canvas.displayMode !== 'AUTO') data.canvases[path].displayMode = canvas.displayMode;
  }
  return { data, legacy };
}
