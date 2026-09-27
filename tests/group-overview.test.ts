import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './visibility.test';
import {
  GROUP_CLASS, GROUP_LABEL_CLASS, GROUP_TITLE_CLASS, NATIVE_GROUP_LABEL_CLASS,
} from '../src/rendering/GroupOverviewRenderer';

const groupSelectors = [GROUP_CLASS, GROUP_LABEL_CLASS, GROUP_TITLE_CLASS, NATIVE_GROUP_LABEL_CLASS].map(name => '.' + name).join(',');
function props(f: Awaited<ReturnType<typeof fixture>>) {
  return f.group.nodeEl.querySelector('.smc-fit-title')!.style;
}

test('OVERVIEW adds centered group label and hides only native label with no data writes', async () => {
  const f = await fixture(); const before = f.geometry();
  const native = f.group.labelEl!;
  native.setAttribute('style', 'color: red;');
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
  assert.equal(f.group.nodeEl.querySelector('.' + GROUP_TITLE_CLASS)?.textContent, 'Region');
  assert.ok(native.classList.contains(NATIVE_GROUP_LABEL_CLASS));
  assert.equal(native.textContent, 'Region'); assert.equal(native.getAttribute('style'), 'color: red;');
  assert.equal(f.geometry(), before); assert.ok(f.group.nodeEl.classList.contains('native-class'));
});

test('STRUCTURE and DETAIL recover the original label and remove all overview DOM', async () => {
  const f = await fixture(); const native = f.group.labelEl;
  for (const mode of ['STRUCTURE', 'DETAIL'] as const) {
    f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
    f.controller.update(f.snapshot(), mode, 100);
    assert.equal(f.root.querySelectorAll(groupSelectors).length, 0);
    assert.equal(f.group.labelEl, native); assert.equal(native!.textContent, 'Region');
  }
});

test('zoom-only updates reuse group DOM and avoid Canvas scans before reconciliation interval', async () => {
  const f = await fixture();
  f.group.saved = { ...f.group.saved, width: 1600, height: 1000 };
  // The enlarged group now contains core; use non-protected content for this zoom-only test.
  await f.store.setLevel('A.canvas', 'core', 3);
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
  const overlay = f.group.nodeEl.querySelector('.' + GROUP_LABEL_CLASS);
  const original = f.group.getData;
  f.group.getData = () => { throw new Error('Unexpected Canvas rescan'); };
  f.controller.update({ ...f.snapshot(), zoom: 0.1 }, 'OVERVIEW', 100);
  assert.equal(f.group.nodeEl.querySelector('.' + GROUP_LABEL_CLASS), overlay);
  assert.equal(Number.parseFloat(props(f).getPropertyValue('--smc-label-scale')) * 32 * 0.1, 24);
  f.group.getData = original;
});

test('unchanged overview samples neither recreate labels nor rewrite attributes', async () => {
  const f = await fixture(); f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
  const overlay = f.group.nodeEl.querySelector('.' + GROUP_LABEL_CLASS);
  let writes = 0;
  for (const el of f.root.querySelectorAll('*')) {
    const original = el.setAttribute.bind(el);
    el.setAttribute = (...args: [string, string]) => { writes++; return original(...args); };
  }
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 100);
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 300);
  assert.equal(writes, 0); assert.equal(f.group.nodeEl.querySelector('.' + GROUP_LABEL_CLASS), overlay);
});

test('native group contenteditable editor stays available and saved rename updates overview', async () => {
  const f = await fixture(); f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
  f.group.labelEl!.setAttribute('contenteditable', 'true');
  f.group.labelEl!.textContent = 'Unsaved edit';
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 300);
  assert.equal(f.root.querySelectorAll(groupSelectors).length, 0);
  assert.equal(f.group.labelEl!.textContent, 'Unsaved edit');
  assert.equal(f.group.labelEl!.getAttribute('contenteditable'), 'true');
  f.group.saved = { ...f.group.saved, label: 'New region' };
  f.group.labelEl!.setAttribute('contenteditable', 'false'); f.group.labelEl!.textContent = 'New region';
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 600);
  assert.equal(f.group.nodeEl.querySelector('.' + GROUP_TITLE_CLASS)?.textContent, 'New region');
});

test('group resize recalculates fit without modifying its data', async () => {
  const f = await fixture(); f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
  const beforeFont = props(f).getPropertyValue('--smc-label-scale');
  f.group.saved = { ...f.group.saved, width: 150, height: 80 };
  const before = f.geometry(); f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 300);
  assert.notEqual(props(f).getPropertyValue('--smc-label-scale'), beforeFont);
  assert.equal(f.geometry(), before);
});

test('group label text is escaped, empty title uses fallback, and native data remains unchanged', async () => {
  const f = await fixture();
  f.group.saved = { ...f.group.saved, label: '<img src=x onerror=alert(1)>' };
  const before = f.geometry();
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
  const title = f.group.nodeEl.querySelector('.' + GROUP_TITLE_CLASS)!;
  assert.equal(title.textContent, '<img src=x onerror=alert(1)>'); assert.equal(title.querySelector('img'), null);
  assert.equal(f.geometry(), before);
  f.group.saved = { ...f.group.saved, label: '' };
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 300);
  assert.equal(title.textContent, 'Untitled group'); assert.equal(f.group.saved.label, '');
});

test('replacement native label and detached group overlay are repaired without leftovers', async () => {
  const f = await fixture(); f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
  const oldNative = f.group.labelEl!;
  const nextNative = f.document.createElement('div'); nextNative.className = 'canvas-group-label';
  nextNative.textContent = 'Region'; oldNative.replaceWith(nextNative); f.group.labelEl = nextNative;
  const oldOverlay = f.group.nodeEl.querySelector('.' + GROUP_LABEL_CLASS)!; oldOverlay.remove();
  f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 300);
  assert.ok(!oldNative.classList.contains(NATIVE_GROUP_LABEL_CLASS));
  assert.ok(nextNative.classList.contains(NATIVE_GROUP_LABEL_CLASS));
  assert.equal(f.group.nodeEl.querySelectorAll('.' + GROUP_LABEL_CLASS).length, 1);
  f.nodes.delete('group'); f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 600);
  assert.equal(f.group.nodeEl.querySelectorAll(groupSelectors).length, 0);
  assert.ok(!f.group.nodeEl.classList.contains(GROUP_CLASS));
});

test('pause, note switch, stop and runtime failure restore every native group label', async () => {
  for (const action of ['pause', 'note', 'stop', 'error']) {
    const f = await fixture(); f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 0);
    const warn = console.warn; console.warn = () => {};
    try {
      if (action === 'pause') f.controller.toggleSuspended();
      if (action === 'note') f.controller.update(null, null, 300);
      if (action === 'stop') { f.controller.stop(); f.controller.stop(); }
      if (action === 'error') {
        f.group.getData = () => { throw new Error('Unsupported runtime'); };
        f.controller.update({ ...f.snapshot(), zoom: 0.2 }, 'OVERVIEW', 300);
      }
      assert.equal(f.root.querySelectorAll(groupSelectors).length, 0, action);
      assert.equal(f.group.labelEl!.textContent, 'Region');
    } finally { console.warn = warn; }
  }
});
