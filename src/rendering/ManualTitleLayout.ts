import type { LayoutInput } from './LabelLayout';
import { balancedBreaks } from './TitlePartition';
import { collectTitleUnits, type TitleUnit } from './TitleUnits';
import { fittedScale, validLabelSize } from './LabelMetrics';

export function flattenTitleRows(flow: HTMLElement): void {
  if (!flow.classList.contains('smc-title-manual')) return;
  const children = Array.from(flow.childNodes);
  for (const child of children) {
    if (child.nodeType === 1 && (child as HTMLElement).classList.contains('smc-title-row')) {
      while (child.firstChild) flow.insertBefore(child.firstChild, child);
      child.remove();
    }
  }
  flow.classList.remove('smc-title-manual');
  flow.normalize();
}

function textMeasure(title: HTMLElement, contexts: Map<Document, CanvasRenderingContext2D | null>): (text: string) => number {
  const doc = title.ownerDocument;
  if (!contexts.has(doc)) {
    const canvas = doc.createElement('canvas');
    contexts.set(doc, typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null);
  }
  const context = contexts.get(doc);
  const style = doc.defaultView?.getComputedStyle?.(title);
  const font = style ? `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}` : '600 32px sans-serif';
  const spacing = parseFloat(style?.letterSpacing ?? '') || 0;
  const wordSpacing = parseFloat(style?.wordSpacing ?? '') || 0;
  if (context) context.font = font;
  return text => {
    const normalized = text.replace(/\s+/g, ' ');
    if (!context) return Array.from(normalized).length * 32;
    return context.measureText(normalized).width + spacing * Array.from(normalized).length
      + wordSpacing * (normalized.match(/ /g)?.length ?? 0);
  };
}

/** Manual rows partition legal break units directly, so reachable row counts cannot be skipped. */
export function layoutManualLabels(inputs: readonly LayoutInput[], _zoom: number): Map<HTMLElement, number> {
  const results = new Map<HTMLElement, number>();
  const contexts = new Map<Document, CanvasRenderingContext2D | null>();
  const plans: Array<{input: LayoutInput; units: TitleUnit[]; breaks: number[]}> = [];
  for (const {title} of inputs) {
    title.classList.add('smc-title-measuring', 'smc-title-single-line');
    title.setCssProps({'--smc-label-width': 'max-content'});
  }
  // All text/formula measurements precede DOM reconstruction.
  for (const input of inputs) {
    const units = collectTitleUnits(input.flow, textMeasure(input.title, contexts));
    plans.push({input, units, breaks: balancedBreaks(units.map(unit => unit.width), Number(input.lines))});
  }
  for (const {input: {flow}, units, breaks} of plans) {
    const rows: HTMLElement[] = []; let start = 0;
    for (const end of breaks) {
      const row = flow.createDiv({cls: 'smc-title-row'});
      for (let i = start; i < end; i++) for (const part of units[i]!.parts) {
        row.append(typeof part === 'string' ? flow.ownerDocument.createTextNode(part) : part);
      }
      rows.push(row); start = end;
    }
    flow.replaceChildren(...rows); flow.classList.add('smc-title-manual');
  }
  for (const {title, width, height} of inputs) {
    const parent = title.parentElement;
    const w = typeof parent?.clientWidth === 'number' ? Math.min(width, parent.clientWidth) : width;
    const h = typeof parent?.clientHeight === 'number' ? Math.min(height, parent.clientHeight) : height;
    const textWidth = Math.max(title.offsetWidth, title.scrollWidth), textHeight = Math.max(title.offsetHeight, title.scrollHeight);
    if (validLabelSize(w, h) && validLabelSize(textWidth, textHeight)) results.set(title, fittedScale(w, h, textWidth, textHeight));
  }
  for (const {title} of inputs) title.classList.remove('smc-title-measuring');
  return results;
}
