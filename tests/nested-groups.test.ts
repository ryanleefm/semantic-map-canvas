import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './visibility.test';
import { containsNode, getGroupContainment } from '../src/semantic/GroupHierarchy';
import { getVisibilityPlan } from '../src/semantic/VisibilityEngine';
import { HIDDEN_CLASS } from '../src/rendering/NodeRenderer';
import { GROUP_LABEL_CLASS, NATIVE_GROUP_LABEL_CLASS } from '../src/rendering/GroupOverviewRenderer';
import type { SemanticLevel } from '../src/semantic/SemanticLevel';

async function nested() {
  const f = await fixture();
  f.nodes.clear(); f.edges.clear(); f.root.replaceChildren(); f.canvas.selection.clear();
  const outer = f.add('outer', 'group', 0, 0, 1500, 1000, { label: 'Outer' });
  const middle = f.add('middle', 'group', 100, 150, 1000, 700, { label: 'Middle' });
  const inner = f.add('inner-group', 'group', 200, 250, 500, 400, { label: 'Inner' });
  const note = f.add('note', 'text', 250, 320, 200, 100);
  f.canvas.nodeInteractionLayer.target = note;
  const plan = (mode: 'DETAIL' | 'STRUCTURE' | 'OVERVIEW' = 'OVERVIEW') => getVisibilityPlan(f.read(), mode, 'A.canvas', f.store);
  const state = (id: string) => plan().nodes.get(id)!;
  return { ...f, outer, middle, inner, note, plan, state };
}
const label = (node: any) => node.nodeEl.querySelector('.' + GROUP_LABEL_CLASS);
const hidden = (node: any) => node.nodeEl.classList.contains(HIDDEN_CLASS);

test('containment is strict for groups, full for nodes, acyclic and stable across input order', async () => {
  const f = await nested(); const nodes = f.read().nodes;
  const outer = nodes.find(n => n.id === 'outer')!;
  const inner = nodes.find(n => n.id === 'inner-group')!;
  assert.equal(containsNode(outer, outer), false);
  assert.equal(containsNode(outer, { ...outer, id: 'equal' }), false);
  assert.equal(containsNode(outer, { ...outer, id: 'equal-note', type: 'text' }), true);
  assert.equal(containsNode(outer, { ...inner, x: 1400 }), false);
  assert.equal(containsNode(outer, { ...inner, width: -1 }), false);
  assert.equal(containsNode({ ...outer, width: 0 }, inner), false);
  assert.deepEqual(getGroupContainment(nodes).innerFirst.map(n => n.id), ['inner-group', 'middle', 'outer']);
  const serialize = (input: typeof nodes) => {
    const tree = getGroupContainment(input);
    return { order: tree.innerFirst.map(n => n.id), descendants: [...tree.descendants].map(([id, children]) => [id, children.map(n => n.id).sort()]) };
  };
  assert.deepEqual(serialize([...nodes].reverse()), serialize(nodes));
  assert.deepEqual(getVisibilityPlan({ nodes: [...nodes].reverse(), edges: [] }, 'OVERVIEW', 'A.canvas', f.store), f.plan());
});

test('all four group levels follow the three-mode matrix independently of ordinary nodes', async () => {
  const f = await nested(); f.nodes.clear();
  for (const level of [1, 2, 3, 4] as const) {
    f.add('g' + level, 'group', level * 1000, 0, 600, 400);
    f.add('n' + level, 'text', level * 1000, 600);
    await f.store.setLevel('A.canvas', 'g' + level, level);
    await f.store.setLevel('A.canvas', 'n' + level, level);
  }
  for (const mode of ['DETAIL', 'STRUCTURE', 'OVERVIEW'] as const) {
    const limit = mode === 'DETAIL' ? 4 : mode === 'STRUCTURE' ? 3 : 2;
    const plan = f.plan(mode);
    for (const level of [1, 2, 3, 4]) {
      assert.equal(plan.nodes.get('g' + level)?.groupDisplay,
        level > limit ? 'hidden' : mode !== 'DETAIL' && level === limit ? 'summary' : 'container');
      assert.equal(plan.nodes.get('n' + level)?.visible, level <= limit);
      assert.equal(plan.nodes.get('n' + level)?.compact, mode !== 'DETAIL' && level <= limit);
    }
  }
});

test('three default L2 nested groups have only the innermost central title', async () => {
  const f = await nested(); const before = f.geometry();
  f.controller.update(f.snapshot(), 'OVERVIEW', 0);
  assert.equal(f.state('outer').groupDisplay, 'container');
  assert.equal(f.state('middle').groupDisplay, 'container');
  assert.equal(f.state('inner-group').groupDisplay, 'summary');
  assert.equal(f.root.querySelectorAll('.' + GROUP_LABEL_CLASS).length, 1);
  assert.ok(label(f.inner)); assert.equal(label(f.outer), null); assert.equal(label(f.middle), null);
  assert.equal(f.outer.labelEl!.classList.contains(NATIVE_GROUP_LABEL_CLASS), false);
  assert.equal(f.inner.labelEl!.classList.contains(NATIVE_GROUP_LABEL_CLASS), true);
  assert.ok(hidden(f.note)); assert.equal(f.geometry(), before);
  await f.store.setLevel('A.canvas', 'outer', 1);
  f.controller.update(f.snapshot(), 'OVERVIEW', 100);
  assert.equal(label(f.outer), null); assert.ok(label(f.inner));
});

test('same/higher priority contents remain visible and block every enclosing summary', async () => {
  const f = await nested();
  for (const level of [2, 1] as const) {
    await f.store.setLevel('A.canvas', 'note', level);
    const plan = f.plan();
    assert.equal(plan.nodes.get('note')?.visible, true);
    for (const id of ['outer', 'middle', 'inner-group']) assert.equal(plan.nodes.get(id)?.groupDisplay, 'container');
  }
  await f.store.setLevel('A.canvas', 'note', 3);
  assert.equal(f.state('note').visible, false);
  assert.equal(f.state('inner-group').groupDisplay, 'summary');
});

test('a hidden intermediate group cannot suppress a visible inner group or its important node', async () => {
  const f = await nested();
  await f.store.setLevel('A.canvas', 'middle', 4);
  assert.equal(f.state('outer').groupDisplay, 'container');
  assert.equal(f.state('middle').groupDisplay, 'hidden');
  assert.equal(f.state('inner-group').groupDisplay, 'summary');
  await f.store.setLevel('A.canvas', 'inner-group', 4);
  await f.store.setLevel('A.canvas', 'note', 1);
  f.controller.update(f.snapshot(), 'OVERVIEW', 0);
  assert.ok(hidden(f.middle)); assert.ok(hidden(f.inner)); assert.equal(hidden(f.note), false);
  assert.equal(label(f.outer), null);
});

test('editing a low priority note protects it and keeps enclosing titles at their edges', async () => {
  const f = await nested(); await f.store.setLevel('A.canvas', 'note', 4);
  f.note.isEditing = true; f.controller.update(f.snapshot(), 'OVERVIEW', 0);
  assert.equal(hidden(f.note), false);
  assert.equal(f.root.querySelectorAll('.' + GROUP_LABEL_CLASS).length, 0);
  assert.equal(f.state('note').compact, false);
  f.note.isEditing = false; f.controller.update(f.snapshot(), 'OVERVIEW', 300);
  assert.ok(hidden(f.note)); assert.ok(label(f.inner));
});

test('native group label editing protects even a normally hidden group and its ancestors', async () => {
  const f = await nested(); await f.store.setLevel('A.canvas', 'inner-group', 4);
  f.inner.labelEl!.setAttribute('contenteditable', 'true');
  f.controller.update(f.snapshot(), 'OVERVIEW', 0);
  assert.equal(hidden(f.inner), false); assert.equal(label(f.middle), null); assert.equal(label(f.outer), null);
  assert.equal(f.inner.labelEl!.classList.contains(NATIVE_GROUP_LABEL_CLASS), false);
  f.inner.labelEl!.setAttribute('contenteditable', 'false');
  f.controller.update(f.snapshot(), 'OVERVIEW', 300);
  assert.ok(hidden(f.inner)); assert.ok(label(f.middle));
});

test('moving/resizing groups and restoring geometry recomputes nesting without stale labels', async () => {
  const f = await nested(); f.nodes.delete('middle');
  f.controller.update(f.snapshot(), 'OVERVIEW', 0);
  const initial = f.geometry(), saved = f.inner.saved;
  assert.equal(label(f.outer), null); assert.ok(label(f.inner));
  f.inner.saved = { ...saved, x: 1400 };
  f.controller.update(f.snapshot(), 'OVERVIEW', 300);
  assert.ok(label(f.outer)); assert.ok(label(f.inner));
  f.inner.saved = { ...saved, width: 1600 };
  f.controller.update(f.snapshot(), 'OVERVIEW', 600);
  assert.ok(label(f.outer));
  // Simulate native undo: same object, original data.
  f.inner.saved = saved; f.controller.update(f.snapshot(), 'OVERVIEW', 900);
  assert.equal(label(f.outer), null); assert.ok(label(f.inner));
  assert.equal(f.geometry(), initial);
});

test('group level changes immediately update label roles and group-endpoint edges/overlays', async () => {
  const f = await nested(); f.nodes.delete('middle');
  const edge = f.edge('group-edge', 'outer', 'inner-group');
  f.canvas.nodeInteractionLayer.target = f.inner; f.canvas.selection.add(f.inner);
  f.controller.update(f.snapshot(), 'OVERVIEW', 0);
  assert.ok(label(f.inner)); assert.equal(label(f.outer), null);
  await f.store.setLevel('A.canvas', 'inner-group', 3);
  f.controller.update(f.snapshot(), 'OVERVIEW', 100);
  assert.ok(hidden(f.inner)); assert.equal(label(f.inner), null); assert.ok(label(f.outer));
  for (const el of [edge.lineGroupEl, edge.lineEndGroupEl, edge.labelElement.wrapperEl, f.interactionEl, f.menuEl]) {
    assert.ok(el.classList.contains(HIDDEN_CLASS));
  }
  await f.store.setLevel('A.canvas', 'inner-group', 2);
  f.controller.update(f.snapshot(), 'OVERVIEW', 200);
  assert.equal(hidden(f.inner), false); assert.ok(label(f.inner)); assert.equal(label(f.outer), null);
  assert.equal(edge.lineGroupEl.classList.contains(HIDDEN_CLASS), false);
  assert.equal(f.inner.nodeEl.querySelectorAll('.' + GROUP_LABEL_CLASS).length, 1);
});

test('L3 group uses central summary in STRUCTURE with zoom compensation and recovers in DETAIL', async () => {
  const f = await nested();
  await f.store.setLevel('A.canvas', 'inner-group', 3);
  await f.store.setLevel('A.canvas', 'note', 4);
  f.controller.update(f.snapshot(), 'STRUCTURE', 0);
  const overlay = label(f.inner); assert.ok(overlay);
  f.controller.update({ ...f.snapshot(), zoom: 0.4 }, 'STRUCTURE', 100);
  assert.equal(label(f.inner), overlay);
  assert.equal(Number(overlay.firstElementChild.style.getPropertyValue('--smc-label-scale')) * 32 * .4, 24);
  f.controller.update(f.snapshot(), 'DETAIL', 200);
  assert.equal(f.root.querySelectorAll('.' + GROUP_LABEL_CLASS).length, 0);
  assert.equal(f.inner.labelEl!.classList.contains(NATIVE_GROUP_LABEL_CLASS), false);
  assert.equal(hidden(f.note), false);
});

test('equal and partly overlapping groups remain peers; shared protected contents protect every container', async () => {
  const f = await nested(); f.nodes.clear();
  f.add('a', 'group', 0, 0, 500, 500);
  f.add('b', 'group', 0, 0, 500, 500);
  f.add('c', 'group', 250, 0, 500, 500);
  for (const id of ['a', 'b', 'c']) assert.equal(f.state(id).groupDisplay, 'summary');
  f.add('shared', 'text', 300, 100, 100, 100);
  await f.store.setLevel('A.canvas', 'shared', 1);
  for (const id of ['a', 'b', 'c']) assert.equal(f.state(id).groupDisplay, 'container');
});

test('unrecognized visible node types conservatively prevent a group summary', async () => {
  const f = await nested(); f.add('future', 'unknown', 250, 350, 100, 100);
  assert.equal(f.state('future').visible, true);
  assert.equal(f.state('inner-group').groupDisplay, 'container');
});

test('pause, switch, disable and runtime failure release every nested group state', async () => {
  for (const action of ['pause', 'switch', 'disable', 'failure']) {
    const f = await nested(); await f.store.setLevel('A.canvas', 'middle', 4);
    const geometry = f.geometry(); f.controller.update(f.snapshot(), 'OVERVIEW', 0);
    assert.ok(label(f.inner)); assert.ok(hidden(f.middle));
    const warn = console.warn; console.warn = () => {};
    try {
      if (action === 'pause') f.controller.toggleSuspended();
      if (action === 'switch') f.controller.update(null, null, 300);
      if (action === 'disable') f.controller.stop();
      if (action === 'failure') {
        f.inner.getData = () => { throw new Error('Unavailable'); };
        f.controller.update(f.snapshot(), 'OVERVIEW', 300);
      }
      assert.equal(f.root.querySelectorAll('.' + GROUP_LABEL_CLASS + ',.' + HIDDEN_CLASS + ',.' + NATIVE_GROUP_LABEL_CLASS).length, 0);
      if (action !== 'failure') assert.equal(f.geometry(), geometry);
    } finally { console.warn = warn; }
  }
});

test('all level combinations in a three-group chain avoid ancestor/descendant central-title pairs', async () => {
  const f = await nested();
  for (const a of [1, 2, 3, 4] as SemanticLevel[]) {
    for (const b of [1, 2, 3, 4] as SemanticLevel[]) {
      for (const c of [1, 2, 3, 4] as SemanticLevel[]) {
        await f.store.setLevel('A.canvas', 'outer', a);
        await f.store.setLevel('A.canvas', 'middle', b);
        await f.store.setLevel('A.canvas', 'inner-group', c);
        for (const mode of ['STRUCTURE', 'OVERVIEW'] as const) {
          const plan = f.plan(mode);
          const central = [...plan.nodes.values()].filter(state => state.groupDisplay === 'summary');
          assert.ok(central.length <= 1, [a, b, c, mode].join('/'));
          for (const [id, state] of plan.nodes) {
            if (state.groupDisplay === 'summary') assert.equal(state.visible, true, id);
          }
        }
      }
    }
  }
});
