export type TitleLines = 'AUTO' | 1 | 2 | 3 | 4 | 5;
export function isTitleLines(value: unknown): value is TitleLines {
  return value === 'AUTO' || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5);
}
export const TITLE_LINES: readonly TitleLines[] = ['AUTO', 1, 2, 3, 4, 5];
export function titleLinesLabel(value: TitleLines): string {
  return value === 'AUTO' ? 'Auto' : value === 1 ? '1 line' : value + ' lines';
}
