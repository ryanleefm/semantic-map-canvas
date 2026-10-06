import type { TitleLines } from '../semantic/TitleLines';

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
export interface LayoutInput {
  title: HTMLElement;
  flow: HTMLElement;
  width: number;
  height: number;
  lines: TitleLines;
}
interface Candidate { width: number; single: boolean }
interface Choice extends Candidate { fit: number; score: number; lines: number }
interface Work {
  input: LayoutInput;
  width: number;
  height: number;
  candidates: Candidate[];
  best?: Choice;
  done?: boolean;
}
function setWidth(title: HTMLElement, width: string, single: boolean): void {
  if (title.style.getPropertyValue('--smc-label-width') !== width) title.setCssProps({'--smc-label-width': width});
  if (title.classList.contains('smc-title-single-line') !== single) title.classList.toggle('smc-title-single-line', single);
}

/** The outer inline flow yields one fragment per title line, excluding math internals. */
export function countTitleLines(flow: HTMLElement): number {
  if (typeof flow.getClientRects !== 'function') return 1;
  let rows = 0, previousTop = NaN;
  for (const rect of Array.from(flow.getClientRects())) {
    // Fragments arrive in line order; adjacent text nodes may share the same baseline.
    if (!Number.isFinite(previousTop) || Math.abs(previousTop - rect.top) > rect.height * 0.2) rows++;
    previousTop = rect.top;
  }
  return rows;
}

/** At most ten candidate passes, batched across dirty titles. Zoom-only updates never enter here. */
export function layoutLabels(inputs: readonly LayoutInput[], zoom: number): Map<HTMLElement, number> {
  const result = new Map<HTMLElement, number>();
  for (const {title} of inputs) { title.classList.add('smc-title-measuring'); setWidth(title, 'max-content', true); }
  const naturalWidths = new Map<HTMLElement, number>();
  for (const {title} of inputs) naturalWidths.set(title, Math.max(title.offsetWidth, title.scrollWidth));
  // break-word preserves word boundaries in min-content sizing; only exceptional strings may split.
  for (const {title} of inputs) setWidth(title, 'min-content', false);
  const work: Work[] = [];
  for (const input of inputs) {
    const {title, flow} = input;
    const natural = naturalWidths.get(title)!;
    const parent = title.parentElement;
    const width = typeof parent?.clientWidth === 'number' ? Math.min(input.width, parent.clientWidth) : input.width;
    const height = typeof parent?.clientHeight === 'number' ? Math.min(input.height, parent.clientHeight) : input.height;
    if (!validLabelSize(natural, title.offsetHeight) || !validLabelSize(width, height)) continue;
    let atomic = Math.min(1024, title.offsetWidth) + 2;
    for (const math of Array.from(flow.querySelectorAll<HTMLElement>('.smc-inline-math'))) {
      atomic = Math.max(atomic, math.offsetWidth + 2, math.scrollWidth + 2);
    }
    const target = Math.max(1, Math.sqrt(natural * height / (LABEL_BASE_SIZE * 1.4 * width)));
    const divisors = input.lines === 1 ? [1] : [1, 2, 3, 4, 5, 8, 12, 20, 40, target];
    const unique = new Map<string, Candidate>();
    for (const divisor of divisors) {
      const candidate = {width: Math.max(atomic, Math.ceil(natural / divisor) + 2), single: divisor === 1};
      unique.set(candidate.width + ':' + candidate.single, candidate);
    }
    const candidates = Array.from(unique.values()).sort((a, b) => b.width - a.width);
    work.push({input, width, height, candidates});
  }
  const cap = SCREEN_SIZE / (LABEL_BASE_SIZE * (Number.isFinite(zoom) && zoom > 0 ? zoom : 1));
  for (let pass = 0; pass < 10; pass++) {
    // Finish writes for all candidates before any reads.
    for (const item of work) {
      const candidate = item.candidates[pass];
      if (candidate && !item.done) setWidth(item.input.title, candidate.width + 'px', candidate.single);
    }
    for (const item of work) {
      const candidate = item.candidates[pass];
      if (!candidate || item.done) continue;
      const {title, flow, lines: limit} = item.input;
      const lines = countTitleLines(flow);
      if (lines < 1 || (limit !== 'AUTO' && lines > limit)) continue;
      const fit = fittedScale(item.width, item.height, Math.max(title.offsetWidth, title.scrollWidth), Math.max(title.offsetHeight, title.scrollHeight));
      // Prefer fewer lines when extra rows would bring only a small font-size gain.
      const score = Math.min(fit, cap) / (1 + 0.35 * Math.log2(lines));
      if (!item.best || score > item.best.score + 0.00001) item.best = {...candidate, fit, score, lines};
      if (lines === 1 && fit >= cap) item.done = true;
    }
  }
  for (const {input, best} of work) {
    if (!best) continue;
    setWidth(input.title, best.width + 'px', best.single);
    result.set(input.title, best.fit);
  }
  for (const {title} of inputs) title.classList.remove('smc-title-measuring');
  return result;
}
