export interface TitlePart { readonly text: string; readonly math: boolean }

/** Conservative single-line delimiters: no edge whitespace, escaped dollars or $$ blocks. */
export function splitInlineMath(text: string): TitlePart[] {
  const parts: TitlePart[] = [];
  const escaped = (at: number): boolean => {
    let count = 0;
    while (at > 0 && text[--at] === '\\') count++;
    return count % 2 === 1;
  };
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$' || escaped(i)) continue;
    if (text[i + 1] === '$') {
      const end = text.indexOf('$$', i + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (!text[i + 1] || /\s/.test(text[i + 1]!)) continue;
    let end = i + 1;
    while (end < text.length && text[end] !== '\n' && (text[end] !== '$' || escaped(end))) end++;
    if (text[end] !== '$' || text[end + 1] === '$' || /\s/.test(text[end - 1]!) || /\d/.test(text[end + 1] ?? '')) continue;
    const source = text.slice(i + 1, end);
    if (!source || /^\d[\d,.]*$/.test(source)) { i = end; continue; }
    if (start < i) parts.push({text: text.slice(start, i), math: false});
    parts.push({text: text.slice(i, end + 1), math: true});
    start = end + 1; i = end;
  }
  if (start < text.length) parts.push({text: text.slice(start), math: false});
  return parts;
}

export function cleanTitleMarkup(text: string): string {
  return splitInlineMath(text).map(part => part.math || part.text.includes('$') ? part.text
    : part.text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '')).join('');
}
