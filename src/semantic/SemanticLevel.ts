export type SemanticLevel = 1 | 2 | 3 | 4;
export interface SemanticNodeMetadata {
  level: SemanticLevel;
  shortLabel?: string;
}
export const DEFAULT_SEMANTIC_LEVEL: SemanticLevel = 3;
export function defaultSemanticLevel(nodeType: string): SemanticLevel {
  return nodeType === 'group' ? 2 : DEFAULT_SEMANTIC_LEVEL;
}
export const SEMANTIC_LEVELS = [
  { level: 1, label: 'L1 Domain' },
  { level: 2, label: 'L2 Core' },
  { level: 3, label: 'L3 Structure' },
  { level: 4, label: 'L4 Detail' },
] as const;
