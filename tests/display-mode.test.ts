import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './visibility.test';
import { getDisplayMode } from '../src/semantic/DisplayMode';
import { HIDDEN_CLASS, COMPACT_CLASS } from '../src/rendering/NodeRenderer';
import type { SemanticLevel } from '../src/semantic/SemanticLevel';

async function minimal(type='text') {
  const f=await fixture();f.nodes.clear();f.edges.clear();f.root.replaceChildren();f.canvas.selection.clear();
  const node=f.add('only',type,0,0,2400,1400,{label:'Region'});
  const sample=()=>({...f.snapshot(),zoom:.05,rawZoom:Math.log2(.05)});
  return {...f,node,sample};
}

test('each highest level caps all raw modes according to the four-level matrix',async()=>{
  const f=await minimal();
  const expected=[
    ['DETAIL','STRUCTURE','OVERVIEW','MAP'],
    ['DETAIL','STRUCTURE','OVERVIEW','OVERVIEW'],
    ['DETAIL','STRUCTURE','STRUCTURE','STRUCTURE'],
    ['DETAIL','DETAIL','DETAIL','DETAIL'],
  ];
  for(const level of [1,2,3,4] as SemanticLevel[]){
    await f.store.setLevel('A.canvas','only',level);
    for(const [index,rawMode] of (['DETAIL','STRUCTURE','OVERVIEW','MAP'] as const).entries()){
      const state=getDisplayMode(f.read().nodes,rawMode,'A.canvas',f.store);
      assert.equal(state.highestLevel,level);assert.equal(state.effectiveMode,expected[level-1]![index]);assert.equal(state.rawMode,rawMode);
    }
  }
});

test('defaults, live IDs and recognized types determine the cap, never stale metadata',async()=>{
  const f=await minimal();
  await f.store.setLevel('A.canvas','deleted',1);
  assert.equal(getDisplayMode(f.read().nodes,'MAP','A.canvas',f.store).highestLevel,3);
  f.add('new-group','group',3000,0,1000,1000);
  assert.equal(getDisplayMode(f.read().nodes,'MAP','A.canvas',f.store).highestLevel,2);
  const unknown=f.add('future','unknown',5000,0);await f.store.setLevel('A.canvas','future',1);
  assert.equal(getDisplayMode(f.read().nodes,'MAP','A.canvas',f.store).highestLevel,2);
  for(const node of [f.node,unknown])assert.equal(node.isEditing,false);
  f.nodes.delete('only');f.nodes.delete('new-group');
  assert.deepEqual(getDisplayMode(f.read().nodes,'MAP','A.canvas',f.store),{selection:'AUTO',rawMode:'MAP',highestLevel:null,effectiveMode:'DETAIL'});
});

test('ordinary nodes and groups stay visible at deep zoom for every highest level',async()=>{
  for(const type of ['text','file','link','group']){
    for(const level of [1,2,3,4] as SemanticLevel[]){
      const f=await minimal(type);await f.store.setLevel('A.canvas','only',level);
      const before=f.geometry();f.controller.update(f.sample(),'MAP',0);
      assert.equal(f.node.nodeEl.classList.contains(HIDDEN_CLASS),false);
      assert.equal(f.controller.getDisplayState()?.highestLevel,level);
      assert.equal(f.geometry(),before);
      if(type==='group')assert.equal(!!f.node.nodeEl.querySelector('.smc-group-overview-label'),level!==4);
      else assert.equal(f.node.nodeEl.classList.contains(COMPACT_CLASS),level!==4);
    }
  }
});

test('add/delete/undo and changes to the sole L1 immediately adjust the effective mode',async()=>{
  const f=await minimal('group');f.controller.update(f.sample(),'MAP',0);
  assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');
  const l1=f.add('top','text',3000,0);await f.store.setLevel('A.canvas','top',1);
  f.controller.update(f.sample(),'MAP',100);assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');
  assert.equal(f.node.nodeEl.classList.contains(HIDDEN_CLASS),true);
  f.nodes.delete('top');f.controller.update(f.sample(),'MAP',200);
  assert.equal(f.store.getLevel('A.canvas','top'),1);
  assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');
  assert.equal(f.node.nodeEl.classList.contains(HIDDEN_CLASS),false);
  f.nodes.set('top',l1);f.controller.update(f.sample(),'MAP',300);
  assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');
  await f.store.setLevel('A.canvas','top',3);f.controller.update(f.sample(),'MAP',400);
  assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');
});

test('same-count replacement keeps polling while capped at DETAIL and sees undo',async()=>{
  const f=await minimal();await f.store.setLevel('A.canvas','only',4);
  await f.store.setLevel('A.canvas','replacement',1);
  f.controller.update(f.sample(),'MAP',0);
  assert.equal(f.controller.getDisplayState()?.effectiveMode,'DETAIL');
  const original=f.node;f.nodes.delete('only');f.add('replacement','text',0,0);
  f.controller.update(f.sample(),'MAP',100);assert.equal(f.controller.getDisplayState()?.effectiveMode,'DETAIL');
  f.controller.update(f.sample(),'MAP',300);assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');
  f.nodes.delete('replacement');f.nodes.set('only',original);
  f.controller.update(f.sample(),'MAP',600);assert.equal(f.controller.getDisplayState()?.effectiveMode,'DETAIL');
});

test('empty/lazy canvases recover and count important nodes whose DOM is not mounted',async()=>{
  const f=await minimal();f.nodes.clear();f.controller.update(f.sample(),'MAP',0);
  assert.deepEqual(f.controller.getDisplayState(),{selection:'AUTO',rawMode:'MAP',highestLevel:null,effectiveMode:'DETAIL'});
  const lazy=f.add('lazy','text',0,0);lazy.nodeEl=null as any;lazy.containerEl=null as any;
  await f.store.setLevel('A.canvas','lazy',1);f.controller.update(f.sample(),'MAP',100);
  assert.equal(f.controller.getDisplayState()?.highestLevel,1);assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');
});

test('editing protection does not promote the reported highest level',async()=>{
  const f=await minimal('group');const child=f.add('child','text',100,100);
  await f.store.setLevel('A.canvas','child',4);child.isEditing=true;
  f.controller.update(f.sample(),'MAP',0);
  assert.deepEqual(f.controller.getDisplayState(),{selection:'AUTO',rawMode:'MAP',highestLevel:2,effectiveMode:'OVERVIEW'});
  assert.equal(child.nodeEl.classList.contains(HIDDEN_CLASS),false);
  assert.equal(f.node.nodeEl.querySelector('.smc-group-overview-label'),null);
});

test('switching files clears the prior cap, and metadata updates still work in actual DETAIL',async()=>{
  const f=await minimal();await f.store.setLevel('A.canvas','only',1);
  await f.store.setLevel('B.canvas','only',4);
  f.controller.update(f.sample(),'MAP',0);
  f.controller.update({...f.sample(),filePath:'B.canvas'},'MAP',100);
  assert.equal(f.controller.getDisplayState()?.effectiveMode,'DETAIL');
  await f.store.setLevel('B.canvas','only',2);
  f.controller.update({...f.sample(),filePath:'B.canvas',zoom:1},'DETAIL',200);
  assert.equal(f.controller.getDisplayState()?.highestLevel,2);
  assert.equal(f.controller.getDisplayState()?.effectiveMode,'DETAIL');
  f.controller.update({...f.sample(),filePath:'B.canvas'},'MAP',300);
  assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');
});

test('only display-state changes emit automatic diagnostics; no paths or node contents are logged',async()=>{
  const f=await minimal('group'),logs:unknown[][]=[],original=console.debug;
  console.debug=(...args:unknown[])=>logs.push(args);
  try{
    f.controller.update(f.sample(),'MAP',0);f.controller.update(f.sample(),'MAP',100);f.controller.update(f.sample(),'MAP',300);
    assert.equal(logs.length,1);
    const note=f.add('secret-note','text',100,100);note.isEditing=true;
    f.controller.update(f.sample(),'MAP',400);assert.equal(logs.length,1);
    await f.store.setLevel('A.canvas','only',1);f.controller.update(f.sample(),'MAP',500);
    assert.equal(logs.length,2);
    assert.deepEqual(logs[1]![1],{selection:'AUTO',rawMode:'MAP',highestLevel:1,effectiveMode:'MAP'});
    assert.equal(JSON.stringify(logs).includes('A.canvas'),false);
    assert.equal(JSON.stringify(logs).includes('secret-note'),false);
  }finally{console.debug=original;}
});

test('pause, unload and read failure restore native rendering and discard the cap',async()=>{
  for(const action of ['pause','unload','failure']){
    const f=await minimal('group');f.controller.update(f.sample(),'MAP',0);
    assert.ok(f.node.nodeEl.querySelector('.smc-group-overview-label'));
    const original=f.node.getData,warn=console.warn;console.warn=()=>{};
    try{
      if(action==='pause')f.controller.toggleSuspended();
      if(action==='unload')f.controller.stop();
      if(action==='failure'){f.node.getData=()=>{throw new Error('Unavailable');};f.controller.update(f.sample(),'MAP',300);}
      assert.equal(f.controller.getDisplayState(),null);
      assert.equal(f.node.nodeEl.querySelector('.smc-group-overview-label'),null);
      assert.equal(f.node.nodeEl.classList.contains(HIDDEN_CLASS),false);
      if(action==='failure'){f.node.getData=original;f.controller.update(f.sample(),'MAP',600);assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');}
    }finally{console.warn=warn;}
  }
});
