import { finishRenderMath, loadMathJax, renderMath } from 'obsidian';
import { splitInlineMath } from '../semantic/InlineMath';

export interface MathAPI {
  load(): Promise<void>;
  render(source: string, display: boolean): HTMLElement;
  finish(): Promise<void>;
}
const nativeMath: MathAPI = {load: loadMathJax, render: renderMath, finish: finishRenderMath};

/** Owned DOM only; cancellation prevents delayed writes after an edit or removal. */
export function renderTitleMath(title: HTMLElement, text: string, changed: () => void,
  api: MathAPI = nativeMath): () => void {
  let active = true;
  const parts = splitInlineMath(text);
  if (parts.some(part => part.math)) {
    void (async () => {
      try {
        await api.load();
        if (!active) return;
        // Use the owning document, including detached test documents and popout windows.
        const fragment = title.ownerDocument.createDocumentFragment();
        for (const part of parts) {
          if (!part.math) { fragment.append(title.ownerDocument.createTextNode(part.text)); continue; }
          try {
            const math = api.render(part.text.slice(1, -1), false);
            if (math.matches('[data-mjx-error], merror') || math.querySelector('[data-mjx-error], merror')) throw new Error('Invalid math');
                const wrapper = title.ownerDocument.createElement('span');
            wrapper.className = 'smc-inline-math';
            wrapper.append(math); fragment.append(wrapper);
          } catch { fragment.append(title.ownerDocument.createTextNode(part.text)); }
        }
        await api.finish();
        if (!active) return;
        title.replaceChildren(fragment);
        changed();
      } catch { /* Keep the original, readable source on initialization failure. */ }
    })();
  }
  return () => { active = false; };
}
