import { splitInlineMath } from '../src/semantic/InlineMath';
import { AdaptiveLabels, fittedScale } from '../src/rendering/AdaptiveLabels';
import { countTitleLines } from '../src/rendering/LabelLayout';
import { TITLE_LINES } from '../src/semantic/TitleLines';
import type { MathAPI } from '../src/rendering/MathTitle';

const samples = [
 {name:'Chinese short',text:'\u7814\u7a76\u4e0e\u7075\u611f',w:500,h:300},
 {name:'Chinese medium',text:'\u8fd9\u662f\u4e00\u4e2a\u9700\u8981\u5b8c\u6574\u663e\u793a\u7684\u4e2d\u6587\u6807\u9898',w:500,h:300},
 {name:'Chinese long punctuation',text:'\u7814\u7a76\u65b9\u5411\uff1a\u300a\u7ed3\u6784\u4e0e\u7ec6\u8282\u300b\uff08\u4e2d\u6587\u6d4b\u8bd5\uff09\uff0c\u4fdd\u7559\u5b8c\u6574\u5185\u5bb9\u3002'.repeat(6),w:500,h:300},
 {name:'English short',text:'Research ideas',w:500,h:300},
 {name:'English sentence',text:'Understanding semantic relationships between English words',w:500,h:300},
 {name:'Edited mixed',text:'Edited \u4e2d\u6587',w:500,h:300},
 {name:'Mixed emoji',text:'\u4e2d\u6587 and English (2026) \ud83d\ude80 \ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66 title',w:500,h:300},
 {name:'Long word',text:'abcdefghij'.repeat(40),w:500,h:300},
 {name:'URL',text:'https://example.test/a-very-long-path/'+'abcdefghij'.repeat(30),w:800,h:120},
 {name:'Tall',text:'\u4e2d\u6587 English long title '.repeat(15),w:140,h:600},
 {name:'Tiny',text:'\u5b8c\u6574\u4fdd\u7559 English title '.repeat(6),w:30,h:20},
 {name:'Empty',text:'',w:500,h:300},
 {name:'Formula',text:'$x_i$',w:500,h:300,math:true},
 {name:'Fraction',text:'\u6bd4\u503c $fraction$ and $x_i$',w:500,h:300,math:true},
 {name:'Matrix',text:'Matrix $matrix$ \u7ed3\u679c',w:500,h:300,math:true},
 {name:'Long formula',text:'\u957f\u516c\u5f0f $long$ with English',w:500,h:300,math:true},
 {name:'Tiny formula',text:'Mixed $fraction$ and $matrix$',w:30,h:20,math:true},
 {name:'Tall formula',text:'English $long$ and $matrix$',w:140,h:600,math:true},
 {name:'Wide formula',text:'Mixed $x_i$ and $fraction$',w:800,h:120,math:true},
 {name:'Invalid delimiters',text:String.raw`\u4ef7\u683c \$25 and $bad$; unclosed $x_i`,w:500,h:300,math:true},
];

function baselineWidth(text:string,w:number,h:number) {
 const advance=Math.max(1,text.length)*32*.65;
 const longest=(text.match(/[a-zA-Z]+/g)??[]).reduce((n,word)=>Math.max(n,word.length),0);
 return Math.min(8192,Math.max(128,Math.min(1024,longest*32*.8),Math.min(advance,Math.sqrt(advance*32*1.4*w/h))));
}
export async function phase15Preview() {
 const results=[];let autoImprovements=0;
 for(const theme of ['light','dark']) for(const type of ['text','group']) for(const sample of samples) {
  const section=document.createElement('section');section.className=theme;document.body.append(section);
  const heading=document.createElement('h2');heading.textContent=type+' / '+sample.name;section.append(heading);
  const world=section.createDiv({cls:'world'});world.style.transform='scale(.3)';
  const parent=world.createDiv({cls:type==='text'?'smc-semantic-label':'smc-group-overview-label'});
  parent.style.position='relative';parent.style.width=sample.w+'px';parent.style.height=sample.h+'px';
  const title=parent.createDiv({cls:'smc-fit-title'+(type==='group'?' smc-group-overview-title':'')});
  const text=sample.text||(type==='text'?'Untitled':'Untitled group');
  const baseline=title.createDiv({cls:'smc-title-flow'});baseline.textContent=text;
  title.setCssProps({'--smc-label-width':baselineWidth(text,sample.w,sample.h)+'px','--smc-label-scale':'1'});
  const oldLines=countTitleLines(baseline),oldFit=fittedScale(sample.w,sample.h,title.scrollWidth,title.scrollHeight);
  let renders=0;
  const api:MathAPI={load:async()=>{},finish:async()=>{},render(source){
   renders++;if(source==='bad')throw new Error('invalid');
   const ns='http://www.w3.org/1998/Math/MathML',math=document.createElementNS(ns,'math');
   if(source==='matrix') {
    const table=document.createElementNS(ns,'mtable');
    for(let i=0;i<3;i++) {const row=document.createElementNS(ns,'mtr');for(let j=0;j<3;j++){const cell=document.createElementNS(ns,'mtd'),value=document.createElementNS(ns,'mn');value.textContent=String(i+j);cell.append(value);row.append(cell);}table.append(row);}math.append(table);
   } else {
    const fraction=document.createElementNS(ns,'mfrac');
    for(const value of ['a+b','c+d']) {const row=document.createElementNS(ns,'mtext');row.textContent=source==='long'?'abcdefghij'.repeat(8):value;fraction.append(row);}math.append(fraction);
   }
   return math as unknown as HTMLElement;
  }};
  let labels=new AdaptiveLabels(api);const hasMath=!!sample.math&&type==='text';
  for(const limit of TITLE_LINES) {
   if(sample.name==='Fraction'){labels.release(title);title.replaceChildren();title.style.removeProperty('--smc-label-scale');labels=new AdaptiveLabels(api);}
   const start=performance.now();labels.prepare(title,text,sample.w,sample.h,hasMath,limit);
   for(let i=0;i<6;i++)await Promise.resolve();labels.flush(.3);
   const elapsed=performance.now()-start,flow=title.querySelector<HTMLElement>('.smc-title-flow')!,lines=countTitleLines(flow);
   const a=parent.getBoundingClientRect(),b=title.getBoundingClientRect();
   const range=document.createRange();range.selectNodeContents(flow);
   const rects=[...range.getClientRects()];
   const contained=rects.every(r=>r.left>=a.left-.2&&r.right<=a.right+.2&&r.top>=a.top-.2&&r.bottom<=a.bottom+.2);
   const centered=Math.abs(a.left+a.width/2-b.left-b.width/2)<.2&&Math.abs(a.top+a.height/2-b.top-b.height/2)<.2;
   const expected=hasMath?splitInlineMath(text).map(part=>!part.math||part.text==='$bad$'?part.text:part.text==='$matrix$'?'012123234':part.text==='$long$'?'abcdefghij'.repeat(16):'a+bc+d').join(''):text;
   const complete=flow.textContent===expected;
   let wordsIntact=true;
   if(!hasMath&&sample.name!=='URL')for(const word of text.matchAll(/[a-zA-Z]+/g)){
    if(word[0].length>30)continue;
    const walker=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];
    while(walker.nextNode())nodes.push(walker.currentNode as Text);
    const locate=(index:number,end=false):[Text,number]=>{for(const node of nodes){if(index<node.length||(end&&index===node.length))return [node,index];index-=node.length;}throw new Error('Text offset missing');};
    const wordRange=document.createRange(),start=locate(word.index),end=locate(word.index+word[0].length,true);wordRange.setStart(...start);wordRange.setEnd(...end);
    if(new Set([...wordRange.getClientRects()].map(r=>r.top)).size>1)wordsIntact=false;
   }
   const actualFont=Number(title.style.getPropertyValue('--smc-label-scale'))*32*.3;
   if(limit==='AUTO'&&!hasMath&&lines<oldLines)autoImprovements++;
   const renderCount=renders;
   const observer=new MutationObserver(()=>{});observer.observe(flow,{subtree:true,childList:true,characterData:true});
   let reads=0;
   const ownDescriptors=new Map<string,PropertyDescriptor|undefined>();
   for(const key of ['offsetWidth','offsetHeight','scrollWidth','scrollHeight']){
    ownDescriptors.set(key,Object.getOwnPropertyDescriptor(title,key));let proto=Object.getPrototypeOf(title),desc:PropertyDescriptor|undefined;
    while(proto&&!desc){desc=Object.getOwnPropertyDescriptor(proto,key);proto=Object.getPrototypeOf(proto);}
    Object.defineProperty(title,key,{configurable:true,get(){reads++;return desc!.get!.call(this);}});
   }
   for(let i=0;i<20;i++)labels.updateZoom(.1+i*.01);
   labels.prepare(title,text,sample.w,sample.h,hasMath,limit);labels.flush(.3);
   const cached=reads===0&&renders===renderCount&&observer.takeRecords().length===0;observer.disconnect();
   for(const [key,descriptor] of ownDescriptors){if(descriptor)Object.defineProperty(title,key,descriptor);else Reflect.deleteProperty(title,key);}
   parent.style.width=sample.w*.55+'px';parent.style.height=sample.h*.7+'px';
   labels.prepare(title,text,sample.w*.55,sample.h*.7,hasMath,limit);labels.flush(.3);
   const small=parent.getBoundingClientRect(),newRange=document.createRange();newRange.selectNodeContents(flow);
   const resized=countTitleLines(flow)>0&&(limit==='AUTO'||countTitleLines(flow)<=limit)&&[...newRange.getClientRects()].every(r=>r.left>=small.left-.2&&r.right<=small.right+.2&&r.top>=small.top-.2&&r.bottom<=small.bottom+.2)&&renders===renderCount;
   parent.style.width=sample.w+'px';parent.style.height=sample.h+'px';
   const passed=wordsIntact&&resized&&contained&&centered&&complete&&cached&&(limit==='AUTO'||lines<=limit)&&(limit!=='AUTO'||!sample.name.endsWith('short')||lines===1);
   results.push({theme,type,case:sample.name,limit,lines,oldLines,actualFont,oldFont:Math.min(oldFit,2.5)*32*.3,contained,centered,complete,cached,resized,wordsIntact,elapsed,flowRects:!passed?[...flow.getClientRects()].map(r=>({y:r.y,h:r.height,w:r.width})):undefined,passed});
  }
  labels.release(title);
 }
 results.push({case:'Auto reduces excessive wrapping in representative titles',autoImprovements,passed:autoImprovements>0});
 return results;
}
