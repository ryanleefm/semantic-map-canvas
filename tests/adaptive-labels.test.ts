import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './visibility.test';
import { AdaptiveLabels, fittedScale, validLabelSize } from '../src/rendering/AdaptiveLabels';
import { conciseLabel } from '../src/semantic/VisibilityEngine';

test('adaptive fitting has no minimum size and rejects invalid geometry', () => {
  assert.ok(fittedScale(1, 1, 1000, 1000) < .001);
  for (const value of [0, -1, NaN, Infinity]) {
    assert.equal(validLabelSize(value, 100), false);
    assert.equal(fittedScale(value, 100, 100, 100), 0);
  }
});
test('adaptive labels cache measurements across zoom and invalidate text and geometry', async () => {
  const f = await fixture(), labels = new AdaptiveLabels();
  const title = f.root.createDiv({cls:'smc-fit-title'});
  let reads = 0;
  for (const prop of ['offsetWidth','scrollWidth','offsetHeight','scrollHeight'])
    Object.defineProperty(title, prop, {get:()=>{reads++; return prop.includes('Width') ? 200 : 100;}});
  labels.prepare(title, '<b>plain</b>', 120, 80); labels.flush(.5);
  assert.equal(title.firstElementChild!.children.length, 0); const initialReads = reads; assert.ok(initialReads > 0);
  labels.prepare(title, '<b>plain</b>', 120, 80); labels.flush(.4);
  labels.updateZoom(.01); assert.equal(reads, initialReads);
  labels.prepare(title, 'changed', 120, 80); labels.flush(.4); assert.ok(reads > initialReads); const changedReads = reads;
  labels.prepare(title, 'changed', 60, 80); labels.flush(.4); assert.ok(reads > changedReads);
  labels.release(title); const previous=title.getAttribute('style');
  labels.updateZoom(10); assert.equal(title.getAttribute('style'), previous);
});
test('replaced inner title and removed node release adaptive cache', async () => {
  const f=await fixture(); f.controller.update(f.snapshot(),'STRUCTURE',0);
  const old=f.core.nodeEl.querySelector('.smc-fit-title')!; old.remove();
  f.controller.update(f.snapshot(),'STRUCTURE',300);
  assert.ok(f.core.nodeEl.querySelector('.smc-fit-title'));
  const style=old.getAttribute('style');
  f.controller.update({...f.snapshot(),zoom:.01},'STRUCTURE',400);
  assert.equal(old.getAttribute('style'),style);
  f.nodes.delete('core'); f.controller.update(f.snapshot(),'STRUCTURE',600);
  assert.equal(f.core.nodeEl.querySelector('.smc-fit-title'),null);
  f.controller.stop(); assert.equal(f.root.querySelector('.smc-fit-title'),null);
});
test('first nonempty line remains complete beyond 2000 characters', () => {
  const text='标题😀'.repeat(800);
  assert.equal(conciseLabel({type:'text',text:'\n\n# '+text+'\nbody'} as never), text);
});

test('font watchers share one document and dispose after the last label', async () => {
 const {LabelFonts}=await import('../src/rendering/LabelFonts');
 const f=await fixture(),fonts=new LabelFonts();
 const first=fonts.acquire(f.document as never),second=fonts.acquire(f.document as never);
 assert.equal(first,second); assert.equal(first.users,2);
 f.document.head.dispatchEvent(new f.document.defaultView.Event('load'));
 assert.equal(first.version,1);
 fonts.release(f.document as never);assert.equal(first.users,1);
 fonts.release(f.document as never);
 f.document.head.dispatchEvent(new f.document.defaultView.Event('load'));assert.equal(first.version,1);
 const next=fonts.acquire(f.document as never);assert.notEqual(next,first);
 fonts.release(f.document as never);
});
test('invalid node sizes create no labels and recover when dimensions become valid',async()=>{
 const f=await fixture();
 f.core.saved={...f.core.saved,width:0};
 f.group.saved={...f.group.saved,height:0};
 f.controller.update(f.snapshot(),'OVERVIEW',0);
 assert.equal(f.core.nodeEl.querySelector('.smc-fit-title'),null);
 assert.equal(f.group.nodeEl.querySelector('.smc-fit-title'),null);
 f.core.saved={...f.core.saved,width:120};f.group.saved={...f.group.saved,height:400};
 f.controller.update(f.snapshot(),'OVERVIEW',300);
 assert.ok(f.core.nodeEl.querySelector('.smc-fit-title'));
 assert.ok(f.group.nodeEl.querySelector('.smc-fit-title'));
 f.controller.stop();
});
