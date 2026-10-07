export const LABEL_BASE_SIZE = 32;
export const SCREEN_SIZE = 24;
export function validLabelSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}
export function fittedScale(width: number, height: number, textWidth: number, textHeight: number): number {
  if (!validLabelSize(width, height) || !validLabelSize(textWidth, textHeight)) return 0;
  const padding = Math.min(width, height) * 0.06;
  return Math.min((width - 2 * padding) / textWidth, (height - 2 * padding) / textHeight) * 0.98;
}
