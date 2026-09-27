import { LabelFonts } from './LabelFonts';

export const LABEL_BASE_SIZE = 32;
const SCREEN_SIZE = 24;

export function validLabelSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

/** Estimate a balanced wrapping width; actual browser layout determines the final fit. */
export function wrappingWidth(text: string, width: number, height: number): number {
  const advance = Math.max(1, text.length) * LABEL_BASE_SIZE * 0.65;
  return Math.min(8192, Math.max(128, Math.min(advance, Math.sqrt(advance * LABEL_BASE_SIZE * 1.4 * width / height))));
}

export function fittedScale(width: number, height: number, textWidth: number, textHeight: number): number {
  if (!validLabelSize(width, height) || !validLabelSize(textWidth, textHeight)) return 0;
  const padding = Math.min(width, height) * 0.06;
  return Math.min((width - 2 * padding) / textWidth, (height - 2 * padding) / textHeight) * 0.98;
}

interface Entry {
  text: string;
  width: number;
  height: number;
  version: number;
  font: ReturnType<LabelFonts['acquire']>;
  pending: boolean;
  fit: number;
  scale: string;
}

/** Batch all text/width writes, then all measurements, then transform-only writes. */
export class AdaptiveLabels {
  private readonly fonts = new LabelFonts();
  private readonly entries = new Map<HTMLElement, Entry>();

  prepare(title: HTMLElement, text: string, width: number, height: number): boolean {
    if (!validLabelSize(width, height)) { this.release(title); return false; }
    let entry = this.entries.get(title);
    if (!entry) {
      entry = { text: '', width: 0, height: 0, version: -1,
        font: this.fonts.acquire(title.ownerDocument), pending: true, fit: 0, scale: '' };
      this.entries.set(title, entry);
    }
    if (entry.text !== text || entry.width !== width || entry.height !== height || entry.version !== entry.font.version || title.textContent !== text) {
      if (title.textContent !== text) title.textContent = text;
      const value = wrappingWidth(text, width, height) + 'px';
      if (title.style.getPropertyValue('--smc-label-width') !== value) title.setCssProps({ '--smc-label-width': value });
      entry.text = text; entry.width = width; entry.height = height;
      entry.version = entry.font.version; entry.pending = true;
    }
    return true;
  }

  flush(zoom: number): void {
    // Measurements are in untransformed CSS pixels. No geometry reads on zoom-only samples.
    for (const [title, entry] of this.entries) {
      if (!entry.pending) continue;
      const width = Math.max(title.offsetWidth, title.scrollWidth);
      const height = Math.max(title.offsetHeight, title.scrollHeight);
      if (!validLabelSize(width, height)) continue; // Detached/hidden native DOM: retry next full scan.
      const parent = title.parentElement;
      const availableWidth = typeof parent?.clientWidth === 'number' ? Math.min(entry.width, parent.clientWidth) : entry.width;
      const availableHeight = typeof parent?.clientHeight === 'number' ? Math.min(entry.height, parent.clientHeight) : entry.height;
      if (!validLabelSize(availableWidth, availableHeight)) continue;
      entry.fit = fittedScale(availableWidth, availableHeight, width, height);
      entry.pending = false;
    }
    this.updateZoom(zoom);
  }

  updateZoom(zoom: number): void {
    if (!Number.isFinite(zoom) || zoom <= 0) return;
    for (const [title, entry] of this.entries) {
      const value = String(Math.min(entry.fit, SCREEN_SIZE / (LABEL_BASE_SIZE * zoom)));
      if (entry.scale !== value) {
        title.setCssProps({ '--smc-label-scale': value });
        entry.scale = value;
      }
    }
  }

  release(title: HTMLElement): void {
    if (this.entries.delete(title)) this.fonts.release(title.ownerDocument);
  }
}
