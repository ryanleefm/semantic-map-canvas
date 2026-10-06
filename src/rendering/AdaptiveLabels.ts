import { renderTitleMath, type MathAPI } from './MathTitle';
import { LabelFonts } from './LabelFonts';
import { layoutLabels, LABEL_BASE_SIZE, SCREEN_SIZE, validLabelSize } from './LabelLayout';
import type { TitleLines } from '../semantic/TitleLines';
export { LABEL_BASE_SIZE, fittedScale, validLabelSize } from './LabelLayout';

interface Entry {
  text: string;
  math: boolean;
  lines: TitleLines;
  flow: HTMLElement;
  cancel: () => void;
  width: number;
  height: number;
  version: number;
  font: ReturnType<LabelFonts['acquire']>;
  pending: boolean;
  fit: number;
  scale: string;
}

/** Cache content separately from layout; changes to geometry never rerender math. */
export class AdaptiveLabels {
  private readonly fonts = new LabelFonts();
  private readonly entries = new Map<HTMLElement, Entry>();
  constructor(private readonly mathAPI?: MathAPI) {}

  prepare(title: HTMLElement, text: string, width: number, height: number, math = false, lines: TitleLines = 'AUTO'): boolean {
    if (!validLabelSize(width, height)) { this.release(title); return false; }
    let entry = this.entries.get(title);
    if (entry && entry.flow.parentElement !== title) { this.release(title); entry = undefined; }
    if (!entry) {
      title.textContent = '';
      const flow = title.createDiv({cls: 'smc-title-flow'});
      entry = {text: '', math, lines, flow, cancel: () => {}, width: 0, height: 0, version: -1,
        font: this.fonts.acquire(title.ownerDocument), pending: true, fit: 0, scale: ''};
      this.entries.set(title, entry);
    }
    if (entry.text !== text || entry.width !== width || entry.height !== height || entry.lines !== lines
      || entry.version !== entry.font.version || entry.math !== math) {
      if (entry.text !== text || entry.math !== math) {
        entry.cancel();
        entry.flow.textContent = text;
        const current = entry;
        entry.cancel = math ? renderTitleMath(entry.flow, text, () => {
          if (this.entries.get(title) === current) current.pending = true;
        }, this.mathAPI) : () => {};
      }
      entry.text = text; entry.math = math; entry.lines = lines;
      entry.width = width; entry.height = height;
      entry.version = entry.font.version; entry.pending = true;
    }
    return true;
  }

  flush(zoom: number): void {
    const dirty = Array.from(this.entries).filter(([, entry]) => entry.pending);
    const fits = layoutLabels(dirty.map(([title, entry]) => ({title, flow: entry.flow,
      width: entry.width, height: entry.height, lines: entry.lines})), zoom);
    for (const [title, fit] of fits) {
      const entry = this.entries.get(title)!;
      entry.fit = fit; entry.pending = false;
    }
    this.updateZoom(zoom);
  }

  updateZoom(zoom: number): void {
    if (!Number.isFinite(zoom) || zoom <= 0) return;
    for (const [title, entry] of this.entries) {
      const value = String(Math.min(entry.fit, SCREEN_SIZE / (LABEL_BASE_SIZE * zoom)));
      if (entry.scale !== value) {
        title.setCssProps({'--smc-label-scale': value});
        entry.scale = value;
      }
    }
  }

  release(title: HTMLElement): void {
    this.entries.get(title)?.cancel();
    if (this.entries.delete(title)) this.fonts.release(title.ownerDocument);
  }
}
