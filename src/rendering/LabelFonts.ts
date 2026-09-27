interface WatchedDocument {
  version: number;
  users: number;
  dispose(): void;
}

/** One observer per owner document; never watches plugin label mutations. */
export class LabelFonts {
  private readonly documents = new Map<Document, WatchedDocument>();

  acquire(doc: Document): WatchedDocument {
    const existing = this.documents.get(doc);
    if (existing) { existing.users++; return existing; }
    const state: WatchedDocument = { version: 0, users: 1, dispose: () => {} };
    const invalidate = () => { state.version++; };
    const Observer = typeof MutationObserver === 'undefined' ? null : MutationObserver;
    const observer = Observer ? new Observer(invalidate) : null;
    observer?.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    if (doc.body) observer?.observe(doc.body, { attributes: true, attributeFilter: ['class', 'style'] });
    if (doc.head) observer?.observe(doc.head, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'style', 'href', 'media', 'disabled'] });
    doc.fonts?.addEventListener('loadingdone', invalidate);
    doc.fonts?.addEventListener('loadingerror', invalidate);
    doc.head?.addEventListener('load', invalidate, true);
    state.dispose = () => {
      observer?.disconnect();
      doc.fonts?.removeEventListener('loadingdone', invalidate);
      doc.fonts?.removeEventListener('loadingerror', invalidate);
      doc.head?.removeEventListener('load', invalidate, true);
    };
    this.documents.set(doc, state);
    return state;
  }

  release(doc: Document): void {
    const state = this.documents.get(doc);
    if (state && --state.users === 0) { state.dispose(); this.documents.delete(doc); }
  }
}
