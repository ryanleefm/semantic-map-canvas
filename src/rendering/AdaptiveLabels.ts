import { renderTitleMath, type MathAPI } from './MathTitle';
import { LabelFonts } from './LabelFonts';

export const LABEL_BASE_SIZE = 32;
const SCREEN_SIZE = 24;

export function validLabelSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

/** Estimate a balanced wrapping width; actual browser layout determines the final fit. */
export function wrappingWidth(text: string, width: number, height: number): number {
  const advance = Math.max(1, text.length) * LABEL_BASE_SIZE * 0.65;
  const longestWord = (text.match(/[a-zA-Z]+/g) ?? []).reduce((length, word) => Math.max(length, word.length), 0);
  const wordWidth = Math.min(1024, longestWord * LABEL_BASE_SIZE * 0.8);
  return Math.min(8192, Math.max(128, wordWidth, Math.min(advance, Math.sqrt(advance * LABEL_BASE_SIZE * 1.4 * width / height))));
}

export function fittedScale(width: number, height: number, textWidth: number, textHeight: number): number {
  if (!validLabelSize(width, height) || !validLabelSize(textWidth, textHeight)) return 0;
  const padding = Math.min(width, height) * 0.06;
  return Math.min((width - 2 * padding) / textWidth, (height - 2 * padding) / textHeight) * 0.98;
}

interface Entry {
  text: string;
  math: boolean;
  cancel: () => void;
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

  constructor(private readonly mathAPI?: MathAPI) {}

  prepare(title: HTMLElement, text: string, width: number, height: number, math = false): boolean {
    if (!validLabelSize(width, height)) { this.release(title); return false; }
    let entry = this.entries.get(title);
    if (!entry) {
      entry = { text: '', math, cancel: () => {}, width: 0, height: 0, version: -1,
        font: this.fonts.acquire(title.ownerDocument), pending: true, fit: 0, scale: '' };
      this.entries.set(title, entry);
    }
    if (entry.text !== text || entry.width !== width || entry.height !== height || entry.version !== entry.font.version || entry.math !== math) {
      if (entry.text !== text || entry.math !== math) {
        entry.cancel();
        title.textContent = text;
        const current = entry;
        entry.cancel = math ? renderTitleMath(title, text, () => {
          if (this.entries.get(title) === current) current.pending = true;
        }, this.mathAPI) : () => {};
      }
      entry.math = math;
      const value = wrappingWidth(text, width, height) + 'px';
      if (title.style.getPropertyValue('--smc-label-width') !== value) title.setCssProps({ '--smc-label-width': value });
      entry.text = text; entry.width = width; entry.height = height;
      entry.version = entry.font.version; entry.pending = true;
    }
    return true;
  }

  flush(zoom: number): void {
    // Keep atomic formulas inside the layout box before measuring the complete title.
    const widths: Array<[HTMLElement, number]> = [];
    for (const [title, entry] of this.entries) {
      if (!entry.pending || !entry.math) continue;
      let width = wrappingWidth(entry.text, entry.width, entry.height);
      for (const formula of Array.from(title.querySelectorAll<HTMLElement>('.smc-inline-math'))) {
        width = Math.max(width, formula.offsetWidth, formula.scrollWidth);
      }
      widths.push([title, width]);
    }
    for (const [title, width] of widths) {
      const value = width + 'px';
      if (title.style.getPropertyValue('--smc-label-width') !== value) title.setCssProps({'--smc-label-width': value});
    }
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
    this.entries.get(title)?.cancel();
    if (this.entries.delete(title)) this.fonts.release(title.ownerDocument);
  }
}
