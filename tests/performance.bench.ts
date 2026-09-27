import { installLayoutShim } from './layout-shim';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { writeFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { SemanticStore } from '../src/semantic/SemanticStore';
import { VisibilityController } from '../src/rendering/VisibilityController';
import { getVisibilityPlan } from '../src/semantic/VisibilityEngine';
import { readRenderSnapshot } from '../src/canvas/CanvasRenderAdapter';

const stats = (values: number[]) => {
  const sorted = [...values].sort((a,b) => a-b);
  return { medianMs: +sorted[Math.floor(sorted.length/2)]!.toFixed(3), p95Ms: +sorted[Math.ceil(sorted.length*.95)-1]!.toFixed(3) };
};
async function scenario(total: number, groupCount: number) {
  const { document } = parseHTML('<html><body></body></html>');
  installLayoutShim(document);
  document.defaultView.HTMLElement.prototype.createDiv = function(o: {cls:string}) {
    const el = document.createElement('div');el.className=o.cls;this.append(el);return el;
  };
  document.defaultView.HTMLElement.prototype.setCssProps = function(props: Record<string,string>) {
    for(const [key,value] of Object.entries(props))this.style.setProperty(key,value);
  };
  const nodes = new Map(), edges = new Map();
  const metadata: Record<string,{level:number}> = {};
  for(let i=0;i<total;i++) {
    const group=i<groupCount;
    const g=group?i:(i-groupCount)%groupCount;
    const cluster=Math.floor(g/3),depth=g%3;
    const x=(cluster%20)*2400+depth*150, y=Math.floor(cluster/20)*2000+depth*150;
    const saved=group?{id:'n'+i,type:'group',x,y,width:2000-depth*300,height:1600-depth*300,label:'Region '+i}
      :{id:'n'+i,type:'text',x:x+200+(i%3)*220,y:y+300+(i%4)*120,width:200,height:100,text:'Example note '+i};
    const nodeEl=document.createElement('div'),containerEl=document.createElement('div');
    nodeEl.className='canvas-node';containerEl.className='canvas-node-container';nodeEl.append(containerEl);
    const content=document.createElement('div');content.textContent='Native content';containerEl.append(content);
    const labelEl=group?document.createElement('div'):null;if(labelEl){labelEl.className='canvas-group-label';labelEl.textContent=saved.label!;nodeEl.append(labelEl);}
    document.body.append(nodeEl);nodes.set(saved.id,{nodeEl,containerEl,labelEl,getData:()=>saved});
    metadata[saved.id]={level:group?(depth===0?1:2):(i%50===0?1:i%10===0?2:3)};
  }
  for(let i=groupCount;i<total-1;i++) {
    const el=document.createElement('div');document.body.append(el);
    edges.set('e'+i,{lineGroupEl:el,getData:()=>({id:'e'+i,fromNode:'n'+i,toNode:'n'+(i+1)})});
  }
  const store=new SemanticStore({load:async()=>({schemaVersion:2,canvases:{'bench.canvas':{nodes:metadata}}}),save:async()=>{}});
  await store.load();const controller=new VisibilityController(store);
  const snapshot={identity:{nodes,edges},filePath:'bench.canvas',zoom:.2,rawZoom:Math.log2(.2),nodeCount:nodes.size,edgeCount:edges.size};
  const render=readRenderSnapshot(snapshot);const modes=[];
  let now=0;
  for(const mode of ['STRUCTURE','OVERVIEW','MAP'] as const){
    const rules:number[]=[],full:number[]=[],zoomOnly:number[]=[];
    let firstEntryMs=0;
    for(let i=0;i<23;i++){
      let start=performance.now();getVisibilityPlan(render,mode,'bench.canvas',store);let elapsed=performance.now()-start;
      if(i>=3)rules.push(elapsed);
      now+=300;start=performance.now();controller.update(snapshot,mode,now);elapsed=performance.now()-start;
      if(i===0)firstEntryMs=+elapsed.toFixed(3);
      if(i>=3)full.push(elapsed);
      start=performance.now();controller.update({...snapshot,zoom:.19},mode,now+100);elapsed=performance.now()-start;
      if(i>=3)zoomOnly.push(elapsed);
    }
    const moved:number[]=[];
    for(let i=0;i<10;i++){
      nodes.get('n'+groupCount).getData().x+=1;
      now+=300;const start=performance.now();controller.update(snapshot,mode,now);moved.push(performance.now()-start);
    }
    const textChanged:number[]=[];
    for(let i=0;i<10;i++){nodes.get('n'+groupCount).getData().text='Changed title '+i;now+=300;const start=performance.now();controller.update(snapshot,mode,now);textChanged.push(performance.now()-start);}
    modes.push({textChanged:stats(textChanged),mode,firstEntryMs,uncachedRules:stats(rules),fullReconcile:stats(full),zoomOnly:stats(zoomOnly),geometryChanged:stats(moved)});
  }
  controller.stop();
  return {nodes:total,groups:groupCount,edges:edges.size,modes};
}
const results=[];
for(const [total,groups] of [[300,30],[1500,150],[5000,500]])results.push(await scenario(total!,groups!));
const report={environment:{node:process.version,cpu:cpus()[0]?.model,platform:process.platform},samples:20,dom:'linkedom (no browser layout or Obsidian rendering)',results};
writeFileSync('.test-build/phase10-performance.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
