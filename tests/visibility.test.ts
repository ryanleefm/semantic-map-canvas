import { installLayoutShim } from './layout-shim';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { readRenderSnapshot } from '../src/canvas/CanvasRenderAdapter';
import { getVisibilityPlan, conciseLabel } from '../src/semantic/VisibilityEngine';
import { SemanticStore } from '../src/semantic/SemanticStore';
import { VisibilityController } from '../src/rendering/VisibilityController';
import { HIDDEN_CLASS, COMPACT_CLASS, LABEL_CLASS } from '../src/rendering/NodeRenderer';

export async function fixture() {
  const { document } = parseHTML('<html><body><main></main></body></html>');
  // Obsidian's documented DOM helper, scoped to the parent element's document.
  installLayoutShim(document);
  document.defaultView.HTMLElement.prototype.createDiv = function(options: { cls: string }) {
    const child = this.ownerDocument.createElement('div');
    child.className = options.cls; this.appendChild(child); return child;
  };
  document.defaultView.HTMLElement.prototype.setCssProps = function(props: Record<string, string>) {
    for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
  };
  const root = document.querySelector('main')!;
  const nodes = new Map<string, any>();
  const edges = new Map<string, any>();
  function add(id: string, type: string, x: number, y: number, width = 120, height = 100, extra = {}) {
    const nodeEl = document.createElement('div'); nodeEl.className = 'canvas-node native-class';
    const containerEl = document.createElement('div'); containerEl.className = 'canvas-node-container';
    const content = document.createElement('div'); content.className = 'canvas-node-content'; content.textContent = 'Native body';
    containerEl.append(content); nodeEl.append(containerEl); root.append(nodeEl);
    const labelEl = type === 'group' ? document.createElement('div') : null;
    if (labelEl) {
      labelEl.className = 'canvas-group-label';
      labelEl.textContent = (extra as { label?: string }).label ?? '';
      labelEl.setAttribute('contenteditable', 'false');
      nodeEl.append(labelEl);
    }
    const node = { labelEl, saved: Object.freeze({ id, type, x, y, width, height, text: '# ' + id, ...extra }), nodeEl, containerEl, isEditing: false, getData() { return this.saved; } };
    nodes.set(id, node); return node;
  }
  const group = add('group', 'group', 0, 0, 600, 400, { label: 'Region' });
  const inside = add('inside', 'text', 30, 30);
  const core = add('core', 'text', 700, 0);
  const structure = add('structure', 'file', 700, 140, 120, 100, { file: 'folder/Structure.md' });
  const detail = add('detail', 'link', 900, 140, 120, 100, { url: 'https://example.com/path' });
  function edge(id: string, fromNode: string, toNode: string) {
    const lineGroupEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const lineEndGroupEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const wrapperEl = document.createElement('div');
    root.append(lineGroupEl, lineEndGroupEl, wrapperEl);
    const saved = Object.freeze({ id, fromNode, toNode, label: 'Native edge' });
    const result = { lineGroupEl, lineEndGroupEl, labelElement: { wrapperEl }, getData: () => saved };
    edges.set(id, result); return result;
  }
  const visibleEdge = edge('visible', 'core', 'structure');
  const hiddenEdge = edge('hidden', 'structure', 'detail');
  edge('inner', 'inside', 'core');
  const interactionEl = document.createElement('div'), menuEl = document.createElement('div');
  root.append(interactionEl, menuEl);
  const canvas = { nodes, edges, nodeInteractionLayer: { target: detail, interactionEl }, menu: { menuEl }, selection: new Set([detail]) };
  const store = new SemanticStore({ load: async () => null, save: async () => {} }); await store.load();
  await store.setLevel('A.canvas', 'core', 2); await store.setLevel('A.canvas', 'inside', 3); await store.setLevel('A.canvas', 'detail', 4);
  const snapshot = () => ({ identity: canvas, filePath: 'A.canvas', zoom: 0.5, rawZoom: -1, nodeCount: nodes.size, edgeCount: edges.size });
  const read = () => readRenderSnapshot(snapshot());
  const controller = new VisibilityController(store);
  const geometry = () => JSON.stringify({ nodes: [...nodes.values()].map(n => n.getData()), edges: [...edges.values()].map(e => e.getData()) });
  return { add, edge, document, root, nodes, edges, group, inside, core, structure, detail, visibleEdge, hiddenEdge, canvas, interactionEl, menuEl, store, snapshot, read, controller, geometry };
}

test('visibility matrix covers all modes, groups and hidden-endpoint edges', async () => {
  const f = await fixture();
  let plan = getVisibilityPlan(f.read(), 'DETAIL', 'A.canvas', f.store);
  assert.ok([...plan.nodes.values()].every(n => n.visible && !n.compact));
  assert.equal(plan.hiddenEdges.size, 0);
  plan = getVisibilityPlan(f.read(), 'STRUCTURE', 'A.canvas', f.store);
  assert.equal(plan.nodes.get('core')?.visible, true);
  assert.equal(plan.nodes.get('structure')?.compact, true);
  assert.equal(plan.nodes.get('detail')?.visible, false);
  assert.equal(plan.nodes.get('group')?.compact, false);
  assert.ok(plan.hiddenEdges.has('hidden')); assert.ok(!plan.hiddenEdges.has('visible'));
  plan = getVisibilityPlan(f.read(), 'OVERVIEW', 'A.canvas', f.store);
  assert.equal(plan.nodes.get('group')?.visible, true);
  assert.equal(plan.nodes.get('inside')?.visible, false);
  assert.equal(plan.nodes.get('core')?.visible, true);
  assert.equal(plan.nodes.get('structure')?.visible, false);
});

test('overview retains important group contents and restores central summary when they are downgraded', async () => {
  const f = await fixture(); f.controller.update(f.snapshot(), 'OVERVIEW', 0);
  assert.ok(f.inside.nodeEl.classList.contains(HIDDEN_CLASS));
  await f.store.setLevel('A.canvas', 'inside', 2);
  f.controller.update(f.snapshot(), 'OVERVIEW', 100);
  assert.ok(!f.inside.nodeEl.classList.contains(HIDDEN_CLASS));
  assert.ok(f.inside.nodeEl.classList.contains(COMPACT_CLASS));
  assert.equal(f.group.nodeEl.querySelector('.smc-group-overview-label'), null);
  await f.store.setLevel('A.canvas', 'inside', 3);
  f.controller.update(f.snapshot(), 'OVERVIEW', 200);
  assert.ok(f.inside.nodeEl.classList.contains(HIDDEN_CLASS));
  assert.ok(f.group.nodeEl.querySelector('.smc-group-overview-label'));
});

test('structure labels preserve native DOM and render unsafe text literally', async () => {
  const f = await fixture();
  f.core.saved = { ...f.core.saved, text: '<img src=x onerror=alert(1)>' };
  const original = f.core.containerEl.firstChild;
  f.controller.update(f.snapshot(), 'STRUCTURE', 0);
  const label = f.core.nodeEl.querySelector('.' + LABEL_CLASS)!;
  assert.equal(label.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(label.querySelector('img'), null);
  assert.equal(f.core.containerEl.firstChild, original);
  assert.equal(original.textContent, 'Native body');
  assert.equal(f.structure.nodeEl.querySelector('.' + LABEL_CLASS)?.textContent, 'Structure');
});

test('edge lines, arrowheads, labels and native selection overlays hide together', async () => {
  const f = await fixture(); f.controller.update(f.snapshot(), 'STRUCTURE', 0);
  for (const el of [f.hiddenEdge.lineGroupEl, f.hiddenEdge.lineEndGroupEl, f.hiddenEdge.labelElement.wrapperEl, f.interactionEl, f.menuEl]) {
    assert.ok(el.classList.contains(HIDDEN_CLASS));
  }
  assert.ok(!f.visibleEdge.lineGroupEl.classList.contains(HIDDEN_CLASS));
  f.canvas.nodeInteractionLayer.target = f.core; f.canvas.selection = new Set([f.core]);
  f.controller.update(f.snapshot(), 'STRUCTURE', 300);
  assert.ok(!f.interactionEl.classList.contains(HIDDEN_CLASS)); assert.ok(!f.menuEl.classList.contains(HIDDEN_CLASS));
});

test('returning to DETAIL and disabling restore all plugin DOM without geometry writes', async () => {
  const f = await fixture(); const before = f.geometry();
  for (const [time, mode] of [[0, 'STRUCTURE'], [300, 'OVERVIEW'], [600, 'DETAIL']] as const) f.controller.update(f.snapshot(), mode, time);
  assert.equal(f.root.querySelectorAll('.' + HIDDEN_CLASS + ',.' + COMPACT_CLASS + ',.' + LABEL_CLASS).length, 0);
  f.controller.update(f.snapshot(), 'OVERVIEW', 900); f.controller.stop(); f.controller.stop();
  assert.equal(f.root.querySelectorAll('.' + HIDDEN_CLASS + ',.' + COMPACT_CLASS + ',.' + LABEL_CLASS).length, 0);
  assert.equal(f.geometry(), before); assert.ok(f.core.nodeEl.classList.contains('native-class'));
  f.controller.update(f.snapshot(), 'OVERVIEW', 1200);
  assert.equal(f.root.querySelectorAll('.' + LABEL_CLASS).length, 0);
});

test('unchanged samples preserve label identity and make zero DOM attribute/text writes', async () => {
  const f = await fixture(); f.controller.update(f.snapshot(), 'STRUCTURE', 0);
  const label = f.core.nodeEl.querySelector('.' + LABEL_CLASS);
  let writes = 0;
  for (const element of f.root.querySelectorAll('*')) {
    const original = element.setAttribute.bind(element);
    element.setAttribute = (...args: [string, string]) => { writes++; return original(...args); };
  }
  f.controller.update(f.snapshot(), 'STRUCTURE', 100); f.controller.update(f.snapshot(), 'STRUCTURE', 300);
  assert.equal(writes, 0); assert.equal(f.core.nodeEl.querySelector('.' + LABEL_CLASS), label);
});

test('metadata changes apply before the regular scan interval', async () => {
  const f = await fixture(); f.controller.update(f.snapshot(), 'STRUCTURE', 0);
  await f.store.setLevel('A.canvas', 'structure', 4);
  f.controller.update(f.snapshot(), 'STRUCTURE', 100);
  assert.ok(f.structure.nodeEl.classList.contains(HIDDEN_CLASS));
  await f.store.setLevel('A.canvas', 'structure', 3);
  f.controller.update(f.snapshot(), 'STRUCTURE', 200);
  assert.ok(!f.structure.nodeEl.classList.contains(HIDDEN_CLASS));
});

test('editing node stays visible and returns to semantic state after editing', async () => {
  const f = await fixture(); f.detail.isEditing = true; f.controller.update(f.snapshot(), 'OVERVIEW', 0);
  assert.ok(!f.detail.nodeEl.classList.contains(HIDDEN_CLASS));
  assert.ok(!f.detail.nodeEl.classList.contains(COMPACT_CLASS));
  f.detail.isEditing = false; f.controller.update(f.snapshot(), 'OVERVIEW', 300);
  assert.ok(f.detail.nodeEl.classList.contains(HIDDEN_CLASS));
});

test('same-count node replacement and detached overlay replacement release stale elements', async () => {
  const f = await fixture(); f.controller.update(f.snapshot(), 'STRUCTURE', 0);
  const old = f.core.nodeEl; const oldArrow = f.hiddenEdge.lineEndGroupEl;
  f.core.nodeEl = old.cloneNode(true); f.core.containerEl = f.core.nodeEl.querySelector('.canvas-node-container');
  f.core.containerEl.querySelector('.' + LABEL_CLASS)?.remove();
  old.replaceWith(f.core.nodeEl);
  f.hiddenEdge.lineEndGroupEl = f.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  f.controller.update(f.snapshot(), 'STRUCTURE', 300);
  assert.equal(old.querySelector('.' + LABEL_CLASS), null);
  assert.ok(!old.classList.contains(COMPACT_CLASS)); assert.ok(!oldArrow.classList.contains(HIDDEN_CLASS));
  assert.equal(f.core.nodeEl.querySelectorAll('.' + LABEL_CLASS).length, 1);
  assert.ok(f.hiddenEdge.lineEndGroupEl.classList.contains(HIDDEN_CLASS));
});

test('switching to a note, changing canvas and pause command restore the previous view', async () => {
  const f = await fixture(); f.controller.update(f.snapshot(), 'STRUCTURE', 0);
  f.controller.update(null, null, 100);
  assert.equal(f.root.querySelectorAll('.' + LABEL_CLASS).length, 0);
  f.controller.update(f.snapshot(), 'OVERVIEW', 300);
  assert.equal(f.controller.toggleSuspended(), true);
  f.controller.update(f.snapshot(), 'OVERVIEW', 600);
  assert.equal(f.root.querySelectorAll('.' + HIDDEN_CLASS).length, 0);
  assert.equal(f.controller.toggleSuspended(), false);
  f.controller.update(f.snapshot(), 'OVERVIEW', 900);
  assert.ok(f.inside.nodeEl.classList.contains(HIDDEN_CLASS));
  f.controller.update({ ...f.snapshot(), filePath: 'B.canvas' }, 'STRUCTURE', 1000);
  assert.ok(!f.detail.nodeEl.classList.contains(HIDDEN_CLASS));
});

test('unsupported runtime restores native rendering and recovers without a reload', async () => {
  const f = await fixture(); f.controller.update(f.snapshot(), 'STRUCTURE', 0);
  const original = f.detail.getData; f.detail.getData = () => { throw new Error('unsupported'); };
  const warn = console.warn; console.warn = () => {};
  try {
    f.controller.update(f.snapshot(), 'STRUCTURE', 300);
    assert.equal(f.root.querySelectorAll('.' + HIDDEN_CLASS + ',.' + LABEL_CLASS).length, 0);
    f.detail.getData = original; f.controller.update(f.snapshot(), 'STRUCTURE', 600);
    assert.ok(f.detail.nodeEl.classList.contains(HIDDEN_CLASS));
  } finally { console.warn = warn; }
});

test('concise labels support metadata override, URL, empty text and untruncated titles', async () => {
  const f = await fixture(); const nodes = f.read().nodes;
  assert.equal(conciseLabel(nodes.find(n => n.id === 'detail')!), 'example.com');
  assert.equal(conciseLabel(nodes[0]!, ' Custom label '), 'Custom label');
  assert.equal(conciseLabel({ ...nodes[0]!, type: 'text', text: '' }), 'Untitled');
  assert.equal(conciseLabel({ ...nodes[0]!, type: 'text', text: 'a'.repeat(200) }).length, 200);
});
