import type { ZoomMode } from './ZoomMode';
export type DisplaySelection = 'AUTO' | ZoomMode;
export const DISPLAY_OPTIONS = [
  { value: 'AUTO', label: 'Auto' },
  { value: 'MAP', label: 'L1 — Map' },
  { value: 'OVERVIEW', label: 'L2 — Overview' },
  { value: 'STRUCTURE', label: 'L3 — Structure' },
  { value: 'DETAIL', label: 'L4 — Detail' },
] as const;
export function isDisplaySelection(value: unknown): value is DisplaySelection {
  return DISPLAY_OPTIONS.some(option => option.value === value);
}
