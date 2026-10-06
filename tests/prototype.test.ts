import './title-lines.test';
import './math-title.test';
import './display-mode.test';
import './containment-cache.test';
import './map-mode.test';
import './nested-groups.test';
import './migration.test';
import './group-overview.test';
import './visibility.test';
import './semantic.test';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { CanvasAdapter } from '../src/canvas/CanvasAdapter';
import { CanvasObserver } from '../src/canvas/CanvasObserver';
import { DEFAULT_ZOOM_THRESHOLDS, getZoomMode } from '../src/semantic/ZoomMode';
import SemanticMapCanvasPlugin from '../src/main';

function harness() {
  const node = Object.freeze({ id: 'n1', x: 10, y: 20, width: 300, height: 200 });
  const canvas = { zoom: 0, nodes: new Map([['n1', node]]), edges: new Map() };
  let active: unknown = { getViewType: () => 'canvas', file: { path: 'A.canvas' }, canvas };
  const app = { workspace: { getActiveViewOfType: () => active } };
  const adapter = new CanvasAdapter(app as never);
  return { canvas, node, adapter, app, setActive: (value: unknown) => { active = value; } };
}

function clock() {
  const callbacks = new Map<number, () => void>();
  let serial = 0;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setInterval: (callback: () => void) => { callbacks.set(++serial, callback); return serial; },
    clearInterval: (id: number) => { callbacks.delete(id); },
  } });
  return {
    callbacks,
    tick: () => { for (const callback of callbacks.values()) callback(); },
    restore: () => {
      if (original) Object.defineProperty(globalThis, 'window', original);
      else Reflect.deleteProperty(globalThis, 'window');
    },
  };
}

test('initial modes use linear boundaries, including equality', () => {
  for (const [zoom, mode] of [[1, 'DETAIL'], [0.61, 'DETAIL'], [0.6, 'STRUCTURE'], [0.26, 'STRUCTURE'], [0.25, 'OVERVIEW'], [0.1, 'MAP'], [0.09, 'MAP'], [0.11, 'OVERVIEW']] as const) {
    assert.equal(getZoomMode(zoom), mode);
  }
});

test('both hysteresis bands resist jitter and support direct jumps', () => {
  assert.equal(getZoomMode(0.59, 'DETAIL'), 'DETAIL');
  assert.equal(getZoomMode(0.58, 'DETAIL'), 'STRUCTURE');
  assert.equal(getZoomMode(0.61, 'STRUCTURE'), 'STRUCTURE');
  assert.equal(getZoomMode(0.62, 'STRUCTURE'), 'DETAIL');
  assert.equal(getZoomMode(0.24, 'STRUCTURE'), 'STRUCTURE');
  assert.equal(getZoomMode(0.23, 'STRUCTURE'), 'OVERVIEW');
  assert.equal(getZoomMode(0.26, 'OVERVIEW'), 'OVERVIEW');
  assert.equal(getZoomMode(0.27, 'OVERVIEW'), 'STRUCTURE');
  assert.equal(getZoomMode(0.1, 'DETAIL'), 'OVERVIEW');
  assert.equal(getZoomMode(1, 'OVERVIEW'), 'DETAIL');
});

test('invalid input and overlapping configuration are rejected', () => {
  for (const value of [NaN, Infinity, -1, 0]) assert.throws(() => getZoomMode(value), RangeError);
  assert.throws(() => getZoomMode(1, null, { ...DEFAULT_ZOOM_THRESHOLDS, overview: 0.25, detail: 0.6, hysteresis: 0.2 }), RangeError);
  assert.equal(getZoomMode(0.4, null, { ...DEFAULT_ZOOM_THRESHOLDS, overview: 0.5, detail: 0.8, hysteresis: 0.03 }), 'OVERVIEW');
});

test('adapter converts log2 zoom, reads maps, and preserves geometry', () => {
  const h = harness();
  const before = JSON.stringify(h.node);
  for (const [raw, scale] of [[0, 1], [-1, 0.5], [-2, 0.25], [1, 2]]) {
    h.canvas.zoom = raw!;
    assert.equal(h.adapter.getSnapshot()?.zoom, scale);
  }
  const handle = h.adapter.getActiveCanvas()!;
  assert.deepEqual(h.adapter.getNodes(handle), [h.node]);
  assert.deepEqual(h.adapter.getEdges(handle), []);
  assert.equal(h.adapter.getSnapshot()?.nodeCount, 1);
  assert.equal(JSON.stringify(h.node), before);
});

test('adapter tolerates non-Canvas, lazy views, and maps from another realm', () => {
  const h = harness();
  h.setActive({ getViewType: () => 'markdown' });
  assert.equal(h.adapter.getSnapshot(), null);
  h.setActive({ getViewType: () => 'canvas' });
  assert.equal(h.adapter.getSnapshot(), null);
  const maps = runInContext('({ nodes: new Map(), edges: new Map() })', createContext({}));
  h.setActive({ getViewType: () => 'canvas', canvas: { zoom: -2, ...maps } });
  assert.equal(h.adapter.getSnapshot()?.zoom, 0.25);
});

test('unsupported runtime warns once and recovers when shape becomes valid', () => {
  const h = harness();
  const original = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    h.canvas.zoom = NaN;
    assert.equal(h.adapter.getSnapshot(), null);
    assert.equal(h.adapter.getSnapshot(), null);
    assert.equal(warnings, 1);
    h.canvas.zoom = 0;
    assert.equal(h.adapter.getSnapshot()?.zoom, 1);
    h.setActive({ getViewType: () => 'canvas', canvas: { zoom: 0, nodes: [], edges: {} } });
    assert.equal(h.adapter.getSnapshot(), null);
    assert.equal(warnings, 2);
  } finally { console.warn = original; }
});

test('sampling emits only changed snapshots and releases timer on unsubscribe', () => {
  const timer = clock();
  const h = harness();
  const snapshots: unknown[] = [];
  try {
    const dispose = h.adapter.onViewportChanged(s => snapshots.push(s));
    assert.equal(snapshots.length, 1);
    timer.tick();
    assert.equal(snapshots.length, 1);
    h.canvas.zoom = -1;
    timer.tick();
    assert.equal(snapshots.length, 2);
    h.setActive(null);
    timer.tick();
    assert.equal(snapshots.at(-1), null);
    dispose(); dispose();
    assert.equal(timer.callbacks.size, 0);
    timer.tick();
    assert.equal(snapshots.length, 3);
  } finally { timer.restore(); }
});

test('observer logs transitions only, resets on file switch, and starts/stops idempotently', () => {
  const timer = clock();
  const h = harness();
  const logs: string[] = [];
  const original = console.debug;
  console.debug = (message: string) => { logs.push(message); };
  const observer = new CanvasObserver(h.adapter);
  try {
    observer.start(); observer.start();
    assert.equal(timer.callbacks.size, 1);
    for (const zoom of [0.8, 0.65, 0.59, 0.57, 0.54, 0.24, 0.22, 0.25, 0.28, 0.63]) {
      h.canvas.zoom = Math.log2(zoom); timer.tick();
    }
    assert.deepEqual(logs.filter(l => l.includes('Zoom mode')).map(l => l.split('\n')[1]), [
      'Zoom mode: INITIAL -> DETAIL', 'Zoom mode: DETAIL -> STRUCTURE',
      'Zoom mode: STRUCTURE -> OVERVIEW', 'Zoom mode: OVERVIEW -> STRUCTURE',
      'Zoom mode: STRUCTURE -> DETAIL',
    ]);
    h.setActive({ getViewType: () => 'canvas', file: { path: 'B.canvas' }, canvas: h.canvas });
    timer.tick();
    assert.ok(logs.at(-1)?.includes('INITIAL -> DETAIL'));
    observer.stop(); observer.stop();
    assert.equal(timer.callbacks.size, 0);
  } finally { observer.stop(); console.debug = original; timer.restore(); }
});

test('plugin disabled before layout readiness cannot create a late observer', () => {
  const timer = clock();
  try {
    let ready = () => {};
    const plugin = new SemanticMapCanvasPlugin() as SemanticMapCanvasPlugin & { cleanups: Array<() => void> };
    plugin.app = { workspace: { onLayoutReady: (callback: () => void) => { ready = callback; } } } as never;
    plugin.onload();
    for (const cleanup of plugin.cleanups) cleanup();
    ready();
    assert.equal(timer.callbacks.size, 0);
  } finally { timer.restore(); }
});

test('observer supplies unchanged zoom samples for geometry/DOM reconciliation', () => {
  const timer = clock();
  const h = harness();
  const original = console.debug;
  console.debug = () => {};
  const received: unknown[] = [];
  const observer = new CanvasObserver(h.adapter, (snapshot, mode) => received.push({ snapshot, mode }));
  try {
    observer.start();
    timer.tick(); timer.tick();
    assert.equal(received.length, 3);
    observer.stop();
    timer.tick();
    assert.equal(received.length, 3);
    assert.equal(timer.callbacks.size, 0);
  } finally { observer.stop(); console.debug = original; timer.restore(); }
});

test('observer logs MAP transitions and resets its hysteresis for a newly active canvas', () => {
  const timer = clock(); const h = harness(); const logs: string[] = []; const original = console.debug;
  console.debug = (message: string) => logs.push(message);
  const observer = new CanvasObserver(h.adapter);
  try {
    h.canvas.zoom = Math.log2(.08); observer.start();
    h.canvas.zoom = Math.log2(.1); timer.tick();
    assert.equal(logs.filter(l => l.includes('Zoom mode')).length, 1);
    h.setActive({ getViewType: () => 'canvas', file: { path: 'B.canvas' }, canvas: h.canvas });
    timer.tick();
    h.canvas.zoom = Math.log2(.12); timer.tick();
    h.canvas.zoom = Math.log2(.08); timer.tick();
    h.canvas.zoom = 0; timer.tick();
    assert.deepEqual(logs.filter(l => l.includes('Zoom mode')).map(l => l.split('\n')[1]), [
      'Zoom mode: INITIAL -> MAP', 'Zoom mode: INITIAL -> MAP',
      'Zoom mode: MAP -> OVERVIEW', 'Zoom mode: OVERVIEW -> MAP', 'Zoom mode: MAP -> DETAIL',
    ]);
  } finally { observer.stop(); console.debug = original; timer.restore(); }
});

test('repeated plugin enable/disable leaves no sampling timers or workspace/vault listeners', async () => {
  const { TestEvents } = await import('./obsidian-stub');
  const timer = clock(), original = console.debug; console.debug = () => {};
  const view = { getViewType: () => 'canvas', file: {path:'A.canvas'}, canvas: {zoom:0,nodes:new Map(),edges:new Map()} };
  const workspace = Object.assign(new TestEvents(), {getActiveViewOfType:()=>view,onLayoutReady:(cb:()=>void)=>cb()});
  const vault = Object.assign(new TestEvents(), {getAbstractFileByPath:()=>({})});
  try {
    for(let i=0;i<20;i++){
      const plugin = new SemanticMapCanvasPlugin() as SemanticMapCanvasPlugin & {cleanups:Array<()=>void>};
      plugin.app = {workspace,vault} as never;await plugin.onload();timer.tick();
      assert.equal(timer.callbacks.size,1);
      assert.equal(workspace.listeners.get('canvas:node-menu')?.size,2);
      for(const cleanup of plugin.cleanups)cleanup();
      timer.tick();assert.equal(timer.callbacks.size,0);
      assert.ok([...workspace.listeners.values(),...vault.listeners.values()].every(callbacks=>callbacks.size===0));
    }
  } finally {console.debug=original;timer.restore();}
});

test('display caps never feed back into the raw zoom hysteresis state',async()=>{
  const {fixture}=await import('./visibility.test');const f=await fixture(),h=harness(),timer=clock();
  const canvas=Object.assign(f.canvas,{zoom:Math.log2(.08)});
  h.setActive({getViewType:()=> 'canvas',file:{path:'A.canvas'},canvas});
  const original=console.debug;console.debug=()=>{};
  const observer=new CanvasObserver(h.adapter,(snapshot,mode)=>f.controller.update(snapshot,mode));
  try{
    observer.start();
    assert.equal(f.controller.getDisplayState()?.rawMode,'MAP');
    assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');
    canvas.zoom=Math.log2(.1);timer.tick();
    await f.store.setLevel('A.canvas','core',1);timer.tick();
    assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');
    await f.store.setLevel('A.canvas','core',2);timer.tick();
    assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');
    canvas.zoom=Math.log2(.12);timer.tick();
    await f.store.setLevel('A.canvas','core',1);timer.tick();
    assert.equal(f.controller.getDisplayState()?.rawMode,'OVERVIEW');
    assert.equal(f.controller.getDisplayState()?.effectiveMode,'OVERVIEW');
    canvas.zoom=Math.log2(.095);timer.tick();
    assert.equal(f.controller.getDisplayState()?.rawMode,'OVERVIEW');
    canvas.zoom=Math.log2(.089);timer.tick();
    assert.equal(f.controller.getDisplayState()?.effectiveMode,'MAP');
  }finally{observer.stop();f.controller.stop();console.debug=original;timer.restore();}
});

import './adaptive-labels.test';

import './manual-display.test';
