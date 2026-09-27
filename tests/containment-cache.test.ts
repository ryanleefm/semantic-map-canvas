import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GroupContainmentCache, getGroupContainment } from '../src/semantic/GroupHierarchy';
import { fixture } from './visibility.test';

const ids = (value: ReturnType<typeof getGroupContainment>) => ({
  groups: value.innerFirst.map(n => n.id),
  descendants: [...value.descendants].map(([id, children]) => [id, children.map(n => n.id)]),
});
test('cached containment reads current edit state and DOM even when geometry stays unchanged', async () => {
  const f = await fixture(), cache = new GroupContainmentCache();
  const before = f.read().nodes; cache.get(before);
  f.inside.isEditing = true;
  f.group.labelEl!.setAttribute('contenteditable', 'true');
  f.inside.nodeEl = f.inside.nodeEl.cloneNode(true);
  const after = f.read().nodes, result = cache.get(after);
  const child = result.descendants.get('group')!.find(n => n.id === 'inside')!;
  assert.equal(child, after.find(n => n.id === 'inside'));
  assert.equal(child.editing, true); assert.notEqual(child.element, before.find(n => n.id === 'inside')!.element);
  assert.equal(result.innerFirst[0]!.groupLabelEditing, true);
});

test('cache invalidates on moves, resize, type/ID changes, replacements and node count changes', async () => {
  const f = await fixture(), cache = new GroupContainmentCache();
  let nodes = f.read().nodes;
  const check = () => assert.deepEqual(ids(cache.get(nodes)), ids(getGroupContainment(nodes)));
  check();
  nodes = nodes.map(n => n.id === 'inside' ? {...n,x:2000} : n);check();
  nodes = nodes.map(n => n.id === 'group' ? {...n,width:4000} : n);check();
  nodes = nodes.map(n => n.id === 'group' ? {...n,type:'text'} : n);check();
  nodes = nodes.map(n => n.id === 'group' ? {...n,id:'replacement',type:'group'} : n);check();
  nodes = [...nodes].reverse();check();
  nodes = nodes.filter(n => n.id !== 'inside');check();
  cache.clear(); nodes = f.read().nodes;check();
});
