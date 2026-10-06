import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitInlineMath, cleanTitleMarkup } from '../src/semantic/InlineMath';
import { renderTitleMath, type MathAPI } from '../src/rendering/MathTitle';
import { AdaptiveLabels } from '../src/rendering/AdaptiveLabels';
import { conciseLabel } from '../src/semantic/VisibilityEngine';
import { fixture } from './visibility.test';
const settle = async () => { for (let i=0;i<6;i++) await Promise.resolve(); };
test('inline math preserves scripts, commands and multiple formulas', () => {
 const text=String.raw`Energy $E=mc^2$, $x_i$ and $\frac{a+b}{c+d}$`;
 assert.equal(splitInlineMath(text).filter(p=>p.math).length,3);
 assert.equal(conciseLabel({type:'text',text:'# '+text+'\nbody'} as never),text);
 assert.equal(cleanTitleMarkup('**Energy** $x_i*$'),'Energy $x_i*$');
 assert.equal(conciseLabel({type:'text',text:'ignored'} as never,text),text);
});
test('prices, escaped dollars, incomplete and block delimiters remain literal', () => {
 for(const text of [String.raw`Price \$5 and \$10`, 'Costs $5 and $10', '$25$', '$x_i', '$$x_i$$', '$ x $', '$x\ny$']) {
  assert.equal(splitInlineMath(text).some(p=>p.math),false,text);
  assert.equal(cleanTitleMarkup(text),text);
 }
});
test('math is cached across resize and zoom, and released tasks cannot overwrite titles', async () => {
 const f=await fixture(),title=f.root.createDiv({cls:'smc-fit-title'});
 let renders=0; const api:MathAPI={load:async()=>{},finish:async()=>{},render(source){renders++;const e=f.document.createElement('span');e.textContent='rendered '+source;return e as never;}};
 const labels=new AdaptiveLabels(api);
 labels.prepare(title,'Value $x_i$',300,200,true);await settle();labels.flush(.4);
 assert.equal(renders,1);assert.equal(title.querySelectorAll('.smc-inline-math').length,1);
 for(let i=0;i<20;i++){labels.prepare(title,'Value $x_i$',300+i,200,true);labels.flush(.2);labels.updateZoom(.1);}
 assert.equal(renders,1);
 labels.prepare(title,'$old$',300,200,true);labels.prepare(title,'New text',300,200,true);await settle();
 assert.equal(title.textContent,'New text');
 labels.prepare(title,'$removed$',300,200,true);labels.release(title);title.textContent='released';await settle();assert.equal(title.textContent,'released');
});
test('invalid math and initialization failure preserve readable source',async()=>{
 const f=await fixture(),title=f.root.createDiv({cls:'smc-fit-title'});
 for(const api of [
 {load:async()=>{throw new Error('load');},finish:async()=>{},render:()=>{throw new Error('unused');}},
 {load:async()=>{},finish:async()=>{},render:()=>{throw new Error('bad formula');}},
 {load:async()=>{},finish:async()=>{},render:()=>{const e=f.document.createElement('span');e.setAttribute('data-mjx-error','bad');return e as never;}}
 ]){title.textContent='$bad$';renderTitleMath(title,'$bad$',()=>{},api);await settle();assert.equal(title.textContent,'$bad$');}
});
test('cancellation while stylesheet finishes prevents stale DOM writes',async()=>{
 const f=await fixture(),title=f.root.createDiv({cls:'smc-fit-title'});let finish!:()=>void;
 const api:MathAPI={load:async()=>{},finish:()=>new Promise<void>(resolve=>{finish=resolve;}),render:()=>f.document.createElement('span') as never};
 const cancel=renderTitleMath(title,'$x$',()=>assert.fail('stale callback'),api);await settle();cancel();title.textContent='new';finish();await settle();assert.equal(title.textContent,'new');
});
