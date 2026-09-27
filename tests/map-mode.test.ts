import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ZOOM_THRESHOLDS, getZoomMode, type ZoomMode } from '../src/semantic/ZoomMode';
import { getVisibilityPlan } from '../src/semantic/VisibilityEngine';
import { fixture } from './visibility.test';
import { GROUP_LABEL_CLASS, NATIVE_GROUP_LABEL_CLASS } from '../src/rendering/GroupOverviewRenderer';
import { HIDDEN_CLASS } from '../src/rendering/NodeRenderer';

test('MAP has independent 9%/11% hysteresis and a 10% initial boundary', () => {
  assert.equal(getZoomMode(0.1), 'MAP');
  assert.equal(getZoomMode(0.1001), 'OVERVIEW');
  let mode: ZoomMode = 'OVERVIEW';
  for (const [zoom, expected] of [
    [0.105, 'OVERVIEW'], [0.095, 'OVERVIEW'], [0.09, 'MAP'],
    [0.095, 'MAP'], [0.10, 'MAP'], [0.109, 'MAP'], [0.11, 'OVERVIEW'],
  ] as const) {
    mode = getZoomMode(zoom, mode); assert.equal(mode, expected);
  }
  assert.equal(getZoomMode(.1, 'DETAIL'), 'OVERVIEW');
  assert.equal(getZoomMode(.1, 'MAP'), 'MAP');
});

test('every previous mode can jump directly to every unambiguous target mode', () => {
  for (const previous of ['MAP', 'OVERVIEW', 'STRUCTURE', 'DETAIL'] as const) {
    for (const [zoom, expected] of [[.05, 'MAP'], [.15, 'OVERVIEW'], [.4, 'STRUCTURE'], [.9, 'DETAIL']] as const) {
      assert.equal(getZoomMode(zoom, previous), expected, previous + ' -> ' + expected);
    }
  }
  assert.equal(getZoomMode(.23, 'DETAIL'), 'OVERVIEW');
  assert.equal(getZoomMode(.27, 'MAP'), 'STRUCTURE');
  assert.equal(getZoomMode(.58, 'DETAIL'), 'STRUCTURE');
  assert.equal(getZoomMode(.62, 'MAP'), 'DETAIL');
});

test('MAP configuration validates finite separated bands and supports custom thresholds', () => {
  for (const changes of [
    { map: NaN }, { mapHysteresis: Infinity }, { map: 0 },
    { mapHysteresis: -.01 }, { map: .01, mapHysteresis: .01 },
    { map: .22, mapHysteresis: .02 }, { overview: .1 }, { detail: .27 },
  ]) assert.throws(() => getZoomMode(.1, null, { ...DEFAULT_ZOOM_THRESHOLDS, ...changes }), RangeError);
  const config = { ...DEFAULT_ZOOM_THRESHOLDS, map: .12, mapHysteresis: .02 };
  assert.equal(getZoomMode(.12, null, config), 'MAP');
  assert.equal(getZoomMode(.099, 'OVERVIEW', config), 'MAP');
  assert.equal(getZoomMode(.141, 'MAP', config), 'OVERVIEW');
});

async function mapFixture() {
  const f = await fixture();
  f.nodes.clear(); f.edges.clear(); f.root.replaceChildren(); f.canvas.selection.clear();
  const outer = f.add('domain', 'group', 0, 0, 3000, 1800, { label: 'Domain' });
  const inner = f.add('topic', 'group', 150, 200, 1200, 1300, { label: 'Topic' });
  const note = f.add('body', 'text', 300, 500, 500, 200);
  const outside = f.add('outside', 'text', 3300, 500, 500, 200);
  await f.store.setLevel('A.canvas', 'domain', 1);
  await f.store.setLevel('A.canvas', 'outside', 1);
  f.canvas.nodeInteractionLayer.target = inner;
  const edge = f.edge('domain-topic', 'domain', 'topic');
  const visibleEdge = f.edge('domain-outside', 'domain', 'outside');
  const sample = (zoom: number) => ({ ...f.snapshot(), zoom, rawZoom: Math.log2(zoom) });
  const plan = () => getVisibilityPlan(f.read(), 'MAP', 'A.canvas', f.store);
  return { ...f, outer, inner, note, outside, edge, visibleEdge, sample, plan };
}
const label = (node: any) => node.nodeEl.querySelector('.' + GROUP_LABEL_CLASS);
const hidden = (node: any) => node.nodeEl.classList.contains(HIDDEN_CLASS);

test('OVERVIEW to MAP hands the central title from L2 inner group to L1 outer group', async () => {
  const f = await mapFixture(); const original = f.geometry();
  f.controller.update(f.sample(.2), 'OVERVIEW', 0);
  assert.equal(label(f.outer), null); assert.ok(label(f.inner));
  f.controller.update(f.sample(.08), 'MAP', 100);
  assert.ok(label(f.outer)); assert.equal(label(f.inner), null);
  assert.ok(hidden(f.inner)); assert.ok(hidden(f.note)); assert.equal(hidden(f.outside), false);
  for (const el of [f.edge.lineGroupEl, f.edge.lineEndGroupEl, f.edge.labelElement.wrapperEl]) assert.ok(el.classList.contains(HIDDEN_CLASS));
  assert.equal(f.visibleEdge.lineGroupEl.classList.contains(HIDDEN_CLASS), false);
  f.controller.update(f.sample(.12), 'OVERVIEW', 200);
  assert.equal(label(f.outer), null); assert.ok(label(f.inner)); assert.equal(hidden(f.inner), false);
  assert.equal(f.edge.lineGroupEl.classList.contains(HIDDEN_CLASS), false);
  f.controller.update(f.sample(1), 'DETAIL', 300);
  assert.equal(f.root.querySelectorAll('.' + GROUP_LABEL_CLASS + ',.' + HIDDEN_CLASS + ',.' + NATIVE_GROUP_LABEL_CLASS).length, 0);
  assert.equal(f.geometry(), original);
});

test('nested L1 groups and L1 contents keep enclosing titles at their edges in MAP', async () => {
  const f = await mapFixture();
  await f.store.setLevel('A.canvas', 'topic', 1);
  f.controller.update(f.sample(.08), 'MAP', 0);
  assert.equal(label(f.outer), null); assert.ok(label(f.inner));
  await f.store.setLevel('A.canvas', 'body', 1);
  f.controller.update(f.sample(.08), 'MAP', 100);
  assert.equal(label(f.outer), null); assert.equal(label(f.inner), null); assert.equal(hidden(f.note), false);
  assert.equal(f.plan().nodes.get('body')?.compact, true);
});

test('MAP preserves ordinary and group editors without promoting their saved levels', async () => {
  const f = await mapFixture(); await f.store.setLevel('A.canvas', 'body', 4);
  f.note.isEditing = true; f.controller.update(f.sample(.08), 'MAP', 0);
  assert.equal(hidden(f.note), false); assert.equal(label(f.outer), null);
  assert.equal(f.plan().nodes.get('body')?.compact, false);
  f.note.isEditing = false; f.inner.labelEl!.setAttribute('contenteditable', 'true');
  f.controller.update(f.sample(.08), 'MAP', 300);
  assert.equal(hidden(f.inner), false); assert.equal(label(f.outer), null); assert.equal(label(f.inner), null);
  f.inner.labelEl!.setAttribute('contenteditable', 'false');
  f.controller.update(f.sample(.08), 'MAP', 600);
  assert.ok(label(f.outer)); assert.ok(hidden(f.inner)); assert.ok(hidden(f.note));
  assert.equal(f.store.getLevel('A.canvas', 'topic', 'group'), 2);
  assert.equal(f.store.getLevel('A.canvas', 'body'), 4);
});

test('a canvas with no L1 caps raw MAP at OVERVIEW and still supports pause', async () => {
  const f = await fixture();
  const plan = getVisibilityPlan(f.read(), 'MAP', 'A.canvas', f.store);
  assert.ok([...plan.nodes.values()].every(state => !state.visible));
  f.controller.update({ ...f.snapshot(), zoom: .08 }, 'MAP', 0);
  assert.equal(f.controller.getDisplayState()?.effectiveMode, 'OVERVIEW');
  assert.ok(label(f.group));
  assert.equal(hidden(f.core), false);
  f.controller.toggleSuspended();
  assert.equal(f.root.querySelectorAll('.' + HIDDEN_CLASS).length, 0);
  f.controller.toggleSuspended();
  f.controller.update(f.snapshot(), 'OVERVIEW', 100);
  assert.ok(label(f.group)); assert.equal(hidden(f.core), false);
});

test('MAP zoom-only updates reuse central labels and preserve readable screen font', async () => {
  const f = await mapFixture(); f.controller.update(f.sample(.08), 'MAP', 0);
  const overlay = label(f.outer); assert.ok(overlay);
  f.outer.getData = () => { throw new Error('Unexpected full scan'); };
  f.controller.update(f.sample(.06), 'MAP', 100);
  assert.equal(label(f.outer), overlay);
  assert.equal(Number.parseFloat(overlay.firstElementChild.style.getPropertyValue('--smc-label-scale')) * 32 * .06, 24);
});

test('MAP restores native rendering on canvas switch, unload or runtime failure', async () => {
  for (const action of ['switch', 'unload', 'failure']) {
    const f = await mapFixture(); f.controller.update(f.sample(.08), 'MAP', 0);
    const warn = console.warn; console.warn = () => {};
    try {
      if (action === 'switch') f.controller.update(null, null, 300);
      if (action === 'unload') f.controller.stop();
      if (action === 'failure') {
        f.outer.getData = () => { throw new Error('Unavailable'); };
        f.controller.update(f.sample(.08), 'MAP', 300);
      }
      assert.equal(f.root.querySelectorAll('.' + GROUP_LABEL_CLASS + ',.' + HIDDEN_CLASS + ',.' + NATIVE_GROUP_LABEL_CLASS).length, 0);
    } finally { console.warn = warn; }
  }
});
