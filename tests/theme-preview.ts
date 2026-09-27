import { VisibilityController } from '../src/rendering/VisibilityController';
import { SemanticStore } from '../src/semantic/SemanticStore';
HTMLElement.prototype.createDiv=function(o){const e=document.createElement('div');e.className=o.cls;this.append(e);return e;};
HTMLElement.prototype.setCssProps=function(p){for(const [k,v]of Object.entries(p))this.style.setProperty(k,v);};
async function run(){
 const results=[];
 for(const theme of ['light','dark']) for(const type of ['text','group']) for(const sample of [
 {name:'Chinese',text:'这是需要完整显示的中央标题：研究与灵感、结构与细节。'.repeat(5),w:1200,h:800},
 {name:'No spaces',text:'abcdefghijklmnopqrstuvwxyz'.repeat(15),w:1200,h:800},
 {name:'Emoji',text:'Mixed 中文 👨‍👩‍👧‍👦 🧑🏽‍💻 é 🚀 '.repeat(18),w:1200,h:800},
 {name:'Tiny',text:'Very small 完整标题'.repeat(4),w:30,h:20},
 {name:'Wide',text:'Wide 完整标题'.repeat(25),w:1800,h:90},
 {name:'Tall',text:'Tall 完整标题'.repeat(25),w:150,h:1000},
 {name:'Empty',text:'',w:1200,h:800},
 {name:'Long first line',text:'完整标题'.repeat(600),w:1200,h:800},
 {name:'Zero',text:'Invalid geometry',w:0,h:0}
 ]){
 const section=document.createElement('section');section.className=theme;document.body.append(section);
 const h=document.createElement('h2');h.textContent=theme+' / '+type+' / '+sample.name;section.append(h);
 const world=section.createDiv({cls:'world'}),element=world.createDiv({cls:type==='group'?'canvas-node-group':'canvas-node'});
 const zoom=.1;world.style.transform='scale('+zoom+')';element.style.width=sample.w+'px';element.style.height=sample.h+'px';
 const container=element.createDiv({cls:'canvas-node-container'}),native=element.createDiv({cls:'canvas-group-label'});
 const data={id:'n',type,x:0,y:0,width:sample.w,height:sample.h,text:sample.text,label:sample.text};
 const store=new SemanticStore({load:async()=>null,save:async()=>{}});await store.load();
 const controller=new VisibilityController(store);
 const snapshot={identity:{nodes:new Map([['n',{getData:()=>data,nodeEl:element,containerEl:container,labelEl:native}]]),edges:new Map()},filePath:'test.canvas',zoom,rawZoom:Math.log2(zoom),nodeCount:1,edgeCount:0};
 controller.update(snapshot,'MAP',0);
 const title=element.querySelector('.smc-fit-title') as HTMLElement;
 if(!sample.w){results.push({theme,type,case:sample.name,passed:!title});controller.stop();continue;}
 const expected=sample.text.trim()||(type==='group'?'Untitled group':'Untitled');
 function fits(){
 const a=title.parentElement.getBoundingClientRect(),b=title.getBoundingClientRect();
 const range=document.createRange();range.selectNodeContents(title);
 const rects=[...range.getClientRects()];
 return {centered:Math.abs(a.left+a.width/2-b.left-b.width/2)<.2&&Math.abs(a.top+a.height/2-b.top-b.height/2)<.2,
 contained:rects.length>0&&rects.every(r=>r.left>=a.left-.15&&r.right<=a.right+.15&&r.top>=a.top-.15&&r.bottom<=a.bottom+.15)};
 }
 let reads=0;
 for(const key of ['offsetWidth','offsetHeight','scrollWidth','scrollHeight']){
 let proto=Object.getPrototypeOf(title),desc;
 while(proto&&!desc){desc=Object.getOwnPropertyDescriptor(proto,key);proto=Object.getPrototypeOf(proto);}
 Object.defineProperty(title,key,{get(){reads++;return desc.get.call(this);}});
 }
 await Promise.resolve();
 controller.update(snapshot,'MAP',300); // settle any font invalidation
 const before=reads,observer=new MutationObserver(()=>{});observer.observe(title,{subtree:true,childList:true,characterData:true});
 controller.update({...snapshot,zoom:.08},'MAP',400);world.style.transform='scale(.08)';
 const zoomFits=fits(),zoomNoReads=reads===before,zoomNoTextWrites=observer.takeRecords().length===0;observer.disconnect();
 controller.update(snapshot,'MAP',600);world.style.transform='scale(.1)';const steadyNoReads=reads===before;
 const fontStyle=document.createElement('style');fontStyle.textContent='.smc-fit-title{font-family:monospace;letter-spacing:2px}';document.head.append(fontStyle);
 await Promise.resolve();controller.update(snapshot,'MAP',900);const fontInvalidated=reads>before,fontFits=fits();
 fontStyle.remove();await Promise.resolve();controller.update(snapshot,'MAP',1200);
 data.width*=.5;element.style.width=data.width+'px';controller.update(snapshot,'MAP',1500);const resized=fits();
 const complete=title.textContent===expected;
 data.text=data.label='Edited 中文 '+sample.text;controller.update(snapshot,'MAP',1800);const edited=fits();
 const passed=complete&&zoomFits.centered&&zoomFits.contained&&zoomNoReads&&zoomNoTextWrites&&steadyNoReads&&fontInvalidated&&fontFits.contained&&resized.contained&&edited.contained;
 results.push({theme,type,case:sample.name,complete,zoomNoReads,zoomNoTextWrites,steadyNoReads,fontInvalidated,zoomFits,fontFits,resized,edited,passed});
 // Keep labels mounted for the screenshot; controller cleanup is covered by unit tests.
 }
 const pre=document.createElement('pre');pre.id='results';pre.textContent=JSON.stringify(results);document.body.append(pre);
}
void run();
