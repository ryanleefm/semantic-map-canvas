import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SemanticStore } from '../src/semantic/SemanticStore';
import { parseMetadata } from '../src/semantic/MetadataSchema';
import { registerSemanticMenu } from '../src/semantic/SemanticMenu';
import { CanvasAdapter } from '../src/canvas/CanvasAdapter';
import { Menu, Notice, Plugin, TestEvents } from './obsidian-stub';
import { AdaptiveLabels } from '../src/rendering/AdaptiveLabels';
import { fixture } from './visibility.test';
import type { MathAPI } from '../src/rendering/MathTitle';

async function harness(type='text') {
 let disk:any=null,fail=false,refreshes=0,writes=0;
 const persistence={load:async()=>disk,save:async(data:unknown)=>{if(fail)throw new Error('disk');disk=JSON.parse(JSON.stringify(data));writes++;}};
 const store=new SemanticStore(persistence);await store.load();
 const workspace=new TestEvents(),vault=Object.assign(new TestEvents(),{getAbstractFileByPath:()=>({})});
 const canvas={view:{file:{path:'A.canvas'}},nodes:new Map()};
 const node={canvas,getData:()=>({id:'n',type})};canvas.nodes.set('n',node);
 const plugin=new Plugin(),app={workspace,vault};plugin.app=app;
 registerSemanticMenu(plugin as never,new CanvasAdapter(app as never),store,()=>refreshes++);
 const open=()=>{const menu=new Menu();workspace.emit('canvas:node-menu',menu,node);return menu.items.find(i=>i.title==='Max title lines')!.submenu!.items;};
 return {store,persistence,canvas,plugin,open,refreshes:()=>refreshes,writes:()=>writes,fail:()=>{fail=true;},disk:()=>disk};
}
test('title lines menu persists all choices for ordinary and group nodes with immediate refresh',async()=>{
 for(const type of ['text','group']) {
  const h=await harness(type);assert.deepEqual(h.open().map(i=>i.title),['Auto','1 line','2 lines','3 lines','4 lines','5 lines']);assert.ok(h.open()[0]!.checked);
  for(let i=1;i<=5;i++) {await h.open()[i]!.callback();assert.equal(h.store.getTitleLines('A.canvas','n'),i);assert.ok(h.open()[i]!.checked);}
  assert.equal(h.refreshes(),5);assert.equal(h.store.getLevel('A.canvas','n',type),type==='group'?2:3);
  const restored=new SemanticStore(h.persistence);await restored.load();assert.equal(restored.getTitleLines('A.canvas','n'),5);
  await h.open()[0]!.callback();assert.equal(h.store.getTitleLines('A.canvas','n'),'AUTO');assert.equal(h.disk().canvases['A.canvas'].nodes.n.titleLines,undefined);
 }
});
test('line settings survive level changes and rename/delete; invalid values default to Auto',async()=>{
 const data={schemaVersion:2,canvases:{'A.canvas':{displayMode:'STRUCTURE',nodes:{n:{level:1,shortLabel:'Custom $x_i$',titleLines:3},bad:{level:2,titleLines:9}}}}};
 let disk:unknown=data;const store=new SemanticStore({load:async()=>disk,save:async(v)=>{disk=v;}});await store.load();
 assert.equal(store.getTitleLines('A.canvas','bad'),'AUTO');assert.equal(store.getTitleLines('A.canvas','missing'),'AUTO');
 await store.setLevel('A.canvas','n',4);assert.equal(store.getTitleLines('A.canvas','n'),3);
 await store.setTitleLines('A.canvas','n',2);assert.equal(store.getShortLabel('A.canvas','n'),'Custom $x_i$');assert.equal(store.getDisplaySelection('A.canvas'),'STRUCTURE');
 await store.renamePath('A.canvas','folder/B.canvas');assert.equal(store.getTitleLines('folder/B.canvas','n'),2);
 await store.renamePath('folder','moved');assert.equal(store.getTitleLines('moved/B.canvas','n'),2);
 await store.deletePath('moved');assert.equal(store.getTitleLines('moved/B.canvas','n'),'AUTO');
 for(const bad of [0,6,1.2,'3',null,NaN]) {await assert.rejects(store.setTitleLines('A.canvas','n',bad as never));}
 await assert.rejects(store.setTitleLines('A.md','n',1));
 const legacy=parseMetadata({schemaVersion:1,canvases:{'A.canvas':{nodes:{n:{level:1}}}}});assert.equal(legacy.data.canvases['A.canvas'].nodes.n.titleLines,undefined);
});
test('line menu handles save errors, stale targets, renamed paths and unload',async()=>{
 const h=await harness(),menu=h.open();h.canvas.view.file.path='B.canvas';await menu[2]!.callback();assert.equal(h.store.getTitleLines('B.canvas','n'),2);
 const errors=console.error;console.error=()=>{};Notice.messages.length=0;
 try {h.fail();await h.open()[3]!.callback();assert.equal(h.store.getTitleLines('B.canvas','n'),2);assert.equal(h.refreshes(),1);assert.ok(Notice.messages.at(-1)?.includes('could not be saved'));}finally{console.error=errors;}
 h.canvas.nodes.clear();await menu[4]!.callback();assert.equal(h.writes(),1);
 for(const cleanup of h.plugin.cleanups)cleanup();await menu[1]!.callback();assert.equal(h.writes(),1);
});
test('line changes invalidate layout without rerendering formulas and late completion uses latest limit',async()=>{
 const f=await fixture(),title=f.root.createDiv({cls:'smc-fit-title'});let renders=0,complete!:()=>void;
 const api:MathAPI={load:async()=>{},finish:()=>new Promise<void>(resolve=>{complete=resolve;}),render:()=>{renders++;return f.document.createElement('span') as never;}};
 const labels=new AdaptiveLabels(api);labels.prepare(title,'$x$',300,100,true,5);labels.flush(.5);
 for(let i=0;i<4;i++)await Promise.resolve();
 labels.prepare(title,'$x$',300,100,true,1);complete();for(let i=0;i<4;i++)await Promise.resolve();labels.flush(.5);
 assert.equal(renders,1);assert.ok(title.classList.contains('smc-title-single-line'));
 labels.prepare(title,'$x$',300,100,true,3);labels.flush(.5);assert.equal(renders,1);labels.release(title);
});
