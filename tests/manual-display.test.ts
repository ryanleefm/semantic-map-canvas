import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SemanticStore } from '../src/semantic/SemanticStore';
import { DISPLAY_OPTIONS } from '../src/semantic/DisplaySelection';
import { CanvasMenuBridge } from '../src/canvas/CanvasMenuBridge';
import { createDisplayMenu } from '../src/semantic/DisplayMenu';
import { CanvasObserver } from '../src/canvas/CanvasObserver';
import { Menu, Plugin, Notice } from './obsidian-stub';
import { fixture } from './visibility.test';

async function storage(initial: unknown = null) {
 let disk=initial, fail=false, writes=0;
 const persistence={load:async()=>disk,save:async(value:unknown)=>{if(fail)throw Error('disk');disk=JSON.parse(JSON.stringify(value));writes++;},backupLegacy:async()=>{}};
 const store=new SemanticStore(persistence);await store.load();
 return {store,persistence,disk:()=>disk,writes:()=>writes,fail:()=>{fail=true;}};
}
test('display choice persists with no nodes, survives level saves, rename and reload',async()=>{
 const h=await storage();assert.equal(h.store.getDisplaySelection('A.canvas'),'AUTO');
 await h.store.setDisplaySelection('A.canvas','MAP');
 await h.store.setLevel('A.canvas','n',3);
 assert.equal(h.store.getDisplaySelection('A.canvas'),'MAP');
 await h.store.renamePath('A.canvas','folder/B.canvas');
 const loaded=new SemanticStore(h.persistence);await loaded.load();
 assert.equal(loaded.getDisplaySelection('folder/B.canvas'),'MAP');
 assert.equal(loaded.getDisplaySelection('A.canvas'),'AUTO');
 assert.equal(loaded.getLevel('folder/B.canvas','n'),3);
 await loaded.deletePath('folder');assert.equal(loaded.getDisplaySelection('folder/B.canvas'),'AUTO');
});
test('old and invalid choices fall back to Auto without destroying shortLabel',async()=>{
 for(const value of [undefined,null,0,'INVALID',{},'AUTO']){
 const h=await storage({schemaVersion:2,canvases:{'A.canvas':{displayMode:value,nodes:{n:{level:2,shortLabel:'keep'}}}}});
 assert.equal(h.store.getDisplaySelection('A.canvas'),'AUTO');
 await h.store.setDisplaySelection('A.canvas','DETAIL');
 assert.equal(h.store.getShortLabel('A.canvas','n'),'keep');
 }
 const h=await storage({schemaVersion:1,canvases:{'A.canvas':{nodes:{n:{level:1}}}}});
 assert.equal(h.store.getDisplaySelection('A.canvas'),'AUTO');assert.equal(h.store.getLevel('A.canvas','n'),2);
});
test('display saving validates values, avoids redundant writes and retains choice after failure',async()=>{
 const h=await storage();await h.store.setDisplaySelection('A.canvas','AUTO');assert.equal(h.writes(),0);
 await h.store.setDisplaySelection('A.canvas','OVERVIEW');const revision=h.store.revision;
 await h.store.setDisplaySelection('A.canvas','OVERVIEW');assert.equal(h.writes(),1);
 await assert.rejects(h.store.setDisplaySelection('A.md','MAP'));
 await assert.rejects(h.store.setDisplaySelection('A.canvas','bad' as never));
 h.fail();await assert.rejects(h.store.setDisplaySelection('A.canvas','MAP'));
 assert.equal(h.store.getDisplaySelection('A.canvas'),'OVERVIEW');assert.equal(h.store.revision,revision);
});
test('all manual choices override zoom and cap while preserving geometry and Auto recovery',async()=>{
 const f=await fixture(),before=f.geometry();
 for(const choice of DISPLAY_OPTIONS.filter(o=>o.value!=='AUTO')){
 await f.store.setDisplaySelection('A.canvas',choice.value);
 for(const [rawMode,zoom] of [['DETAIL',1],['STRUCTURE',.5],['OVERVIEW',.2],['MAP',.05]] as const){
 f.controller.update({...f.snapshot(),zoom},rawMode);
 assert.equal(f.controller.getDisplayState()?.effectiveMode,choice.value);
 assert.equal(f.controller.getDisplayState()?.rawMode,rawMode);
 assert.equal(f.controller.getDisplayState()?.selection,choice.value);
 }
 }
 await f.store.setDisplaySelection('A.canvas','MAP');f.controller.update(f.snapshot(),'DETAIL');
 assert.ok([...f.nodes.values()].every(n=>n.nodeEl.classList.contains('smc-semantic-hidden')));
 await f.store.setDisplaySelection('A.canvas','AUTO');f.controller.update(f.snapshot(),'DETAIL');
 assert.ok([...f.nodes.values()].every(n=>!n.nodeEl.classList.contains('smc-semantic-hidden')));
 assert.equal(f.geometry(),before);f.controller.stop();
});
test('manual titles scale on zoom, editing remains protected and pause retains selection',async()=>{
 const f=await fixture();await f.store.setDisplaySelection('A.canvas','STRUCTURE');
 f.controller.update(f.snapshot(),'DETAIL',0);
 const title=f.core.nodeEl.querySelector('.smc-fit-title')!;
 const first=title.style.getPropertyValue('--smc-label-scale');
 f.controller.update({...f.snapshot(),zoom:10},'DETAIL',100);
 assert.notEqual(title.style.getPropertyValue('--smc-label-scale'),first);
 assert.equal(f.controller.getDisplayState()?.effectiveMode,'STRUCTURE');
 f.controller.toggleSuspended();f.controller.update(f.snapshot(),'MAP',200);
 assert.equal(f.root.querySelector('.smc-fit-title'),null);
 assert.equal(f.store.getDisplaySelection('A.canvas'),'STRUCTURE');
 f.controller.toggleSuspended();f.controller.update(f.snapshot(),'MAP',300);
 assert.ok(f.root.querySelector('.smc-fit-title'));
 await f.store.setDisplaySelection('A.canvas','MAP');f.core.isEditing=true;f.controller.update(f.snapshot(),'MAP',600);
 assert.ok(!f.core.nodeEl.classList.contains('smc-semantic-hidden'));f.controller.stop();
});
test('manual selection is isolated across canvas paths and works on an empty canvas',async()=>{
 const f=await fixture();await f.store.setDisplaySelection('A.canvas','DETAIL');await f.store.setDisplaySelection('B.canvas','MAP');
 f.controller.update(f.snapshot(),'MAP',0);assert.equal(f.controller.getDisplayState()?.effectiveMode,'DETAIL');
 f.controller.update({...f.snapshot(),filePath:'B.canvas'},'DETAIL',100);assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');
 f.nodes.clear();f.edges.clear();f.controller.update({...f.snapshot(),filePath:'B.canvas'},'DETAIL',200);
 assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');f.controller.stop();
});
test('observer retains raw hysteresis during manual mode and refresh uses current zoom',async()=>{
 const f=await fixture();let sample={...f.snapshot(),zoom:.24};let receive:(s:typeof sample)=>void=()=>{};
 const adapter={getSnapshot:()=>sample,onViewportChanged:(cb:typeof receive)=>{receive=cb;cb(sample);return()=>{};}};
 const observer=new CanvasObserver(adapter as never,(s,m)=>f.controller.update(s,m));
 observer.start();await f.store.setDisplaySelection('A.canvas','MAP');observer.refresh();
 sample={...sample,zoom:.26};receive(sample);
 assert.equal(f.controller.getDisplayState()?.rawMode,'OVERVIEW');
 assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');
 await f.store.setDisplaySelection('A.canvas','AUTO');observer.refresh();
 assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');
 sample={...sample,zoom:.28};observer.refresh();assert.equal(f.controller.getDisplayState()?.effectiveMode,'STRUCTURE');
 observer.stop();f.controller.stop();
});
async function menuHarness(){
 const h=await storage(),plugin=new Plugin();let exists=true,refresh=0;
 const native=function(this:unknown,menu:Menu){menu.addItem(i=>i.setTitle('Native'));return this;};
 const proto={showQuickSettingsMenu:native};
 const canvas=Object.assign(Object.create(proto),{view:{file:{path:'A.canvas'}}});
 const app={vault:{getAbstractFileByPath:()=>exists?{}:null}};
 const bridge=new CanvasMenuBridge(app as never,createDisplayMenu(plugin as never,h.store,()=>{refresh++;}));
 bridge.bind({identity:canvas,filePath:'A.canvas'});
 const open=()=>{const menu=new Menu();assert.equal(canvas.showQuickSettingsMenu(menu),canvas);return menu;};
 return {...h,plugin,canvas,bridge,open,native,refresh:()=>refresh,remove:()=>{exists=false;}};
}
test('empty canvas native menu is preserved, options checked, duplicate additions avoided',async()=>{
 const h=await menuHarness(),menu=h.open();
 assert.equal(menu.items[0]!.title,'Native');assert.equal(menu.items[1]!.title,'Display mode');
 const choices=menu.items[1]!.submenu!.items;
 assert.deepEqual(choices.map(i=>i.checked),[true,false,false,false,false]);
 assert.deepEqual(choices.map(i=>i.title),DISPLAY_OPTIONS.map(o=>o.label));
 h.canvas.showQuickSettingsMenu(menu);assert.equal(menu.items.filter(i=>i.title==='Display mode').length,1);
 await choices[1]!.callback();assert.equal(h.store.getDisplaySelection('A.canvas'),'MAP');assert.equal(h.refresh(),1);
 assert.equal(h.open().items[1]!.submenu!.items[1]!.checked,true);h.bridge.clear();
 assert.equal(h.canvas.showQuickSettingsMenu,h.native);assert.equal(Object.hasOwn(h.canvas,'showQuickSettingsMenu'),false);
});
test('open menu resolves rename, rejects deleted canvas and deactivates after switch or unload',async()=>{
 const h=await menuHarness(),menu=h.open();h.canvas.view.file.path='B.canvas';
 await menu.items[1]!.submenu!.items[2]!.callback();assert.equal(h.store.getDisplaySelection('B.canvas'),'OVERVIEW');
 h.remove();await menu.items[1]!.submenu!.items[1]!.callback();assert.equal(h.store.getDisplaySelection('B.canvas'),'OVERVIEW');
 h.bridge.bind(null);for(const cleanup of h.plugin.cleanups)cleanup();
 await menu.items[1]!.submenu!.items[4]!.callback();assert.equal(h.refresh(),1);
 assert.equal(h.open().items.length,1);
});
test('failed display save leaves menu checked on previous selection',async()=>{
 const h=await menuHarness();h.fail();const old=console.error;console.error=()=>{};
 try{await h.open().items[1]!.submenu!.items[1]!.callback();assert.equal(h.refresh(),0);
 assert.equal(h.open().items[1]!.submenu!.items[0]!.checked,true);
 assert.ok(Notice.messages.at(-1)?.includes('Previous selection kept'));
 }finally{console.error=old;h.bridge.clear();}
});
test('later plugin wrapper survives cleanup and dormant wrapper adds no menu',async()=>{
 const h=await menuHarness(),ours=h.canvas.showQuickSettingsMenu;
 const other=function(this:unknown,m:Menu){return ours.call(this,m);};h.canvas.showQuickSettingsMenu=other;
 h.bridge.clear();assert.equal(h.canvas.showQuickSettingsMenu,other);assert.equal(h.open().items.length,1);
});
test('unsupported menu method is ignored without touching the Canvas',()=>{
 const canvas=Object.freeze({showQuickSettingsMenu:42});
 const bridge=new CanvasMenuBridge({} as never,()=>{throw Error('unexpected');});
 bridge.bind({identity:canvas,filePath:'A.canvas'});bridge.clear();assert.equal(canvas.showQuickSettingsMenu,42);
});
