export interface TitleUnit { parts: Array<string | HTMLElement>; width: number }
interface Segmenter { segment(text: string): Iterable<{segment: string}> }
const SegmenterClass = (Intl as unknown as {Segmenter?: new (locale: string, options: {granularity: string}) => Segmenter}).Segmenter;
const segmenter = SegmenterClass ? new SegmenterClass('en', {granularity: 'grapheme'}) : null;
const opening = /^[([{\uFF08\u3010\u300A\u3008\u300C\u300E]$/u;
const closing = /^[,.;:!?%)}\]\uFF0C\u3002\uFF1B\uFF1A\uFF01\uFF1F\u3001\uFF09\u3011\u300B\u3009\u300D\u300F\u2026]$/u;
const latin = /^[\p{Script=Latin}\p{Number}\p{Mark}_]+$/u;

/** Graphemes protect emoji/combining sequences; ordinary Latin words stay intact. */
export function textUnits(text: string): string[] {
  if (!segmenter) return text ? [text] : []; // Preserve text rather than splitting unknown graphemes.
  const pieces: string[] = []; let word = '';
  const flush = () => { if (word) pieces.push(word); word = ''; };
  const graphemes = Array.from(segmenter.segment(text), part => part.segment);
  for (let i = 0; i < graphemes.length; i++) {
    const part = graphemes[i]!;
    if (latin.test(part) || ((part === "'" || part === '\u2019') && word && latin.test(graphemes[i + 1] ?? ''))) word += part;
    else { flush(); pieces.push(part); }
  }
  flush(); return pieces;
}

/** Join whitespace and prohibited punctuation boundaries without changing source text. */
export function collectTitleUnits(flow: HTMLElement, measure: (text: string) => number): TitleUnit[] {
  const raw: Array<string | HTMLElement> = [];
  for (const node of Array.from(flow.childNodes)) {
    if (node.nodeType === 3) raw.push(...textUnits(node.textContent ?? ''));
    else if (node.nodeType === 1) raw.push(node as HTMLElement);
  }
  const units: TitleUnit[] = []; let pending: Array<string | HTMLElement> = [];
  const widthOf = (part: string | HTMLElement) => typeof part === 'string' ? measure(part) : Math.max(part.offsetWidth, part.scrollWidth);
  const emit = (part: string | HTMLElement) => {
    if (typeof part === 'string' && /^\s+$/u.test(part)) {
      if (units.length && !pending.length) { units[units.length - 1]!.parts.push(part); units[units.length - 1]!.width += measure(' '); }
      else pending.push(part);
    } else if (typeof part === 'string' && closing.test(part) && units.length && !pending.length) {
      units[units.length - 1]!.parts.push(part); units[units.length - 1]!.width += widthOf(part);
    } else if (typeof part === 'string' && opening.test(part)) pending.push(part);
    else {
      const parts = [...pending, part]; pending = [];
      units.push({parts, width: parts.reduce((sum, item) => sum + widthOf(item), 0)});
    }
  };
  for (const part of raw) {
    if (typeof part === 'string' && part.length > 1 && measure(part) > 1024 && segmenter) {
      for (const fragment of segmenter.segment(part)) emit(fragment.segment);
    } else emit(part);
  }
  if (pending.length) {
    if (!units.length) units.push({parts: [], width: 0});
    const last = units[units.length - 1]!; last.parts.push(...pending);
    last.width += pending.reduce<number>((sum, part) => sum + widthOf(part), 0);
  }
  return units;
}
