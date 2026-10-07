import { AdaptiveLabels } from '../src/rendering/AdaptiveLabels';
import { countTitleLines } from '../src/rendering/LabelLayout';
import { layoutLabels as oldLayout } from './phase16-baseline';
import type { MathAPI } from '../src/rendering/MathTitle';
import { conciseLabel } from '../src/semantic/VisibilityEngine';

const cases = [
 {name:'Four Chinese characters; three rows is reachable',text:'\u4e2d\u6587\u6807\u9898',available:4},
 {name:'Five English words',text:'one two three four five',available:5},
 {name:'Unequal English words',text:'a WWWWWW b WWWWWW c',available:5},
 {name:'One indivisible word',text:'Research',available:1},
 {name:'Two indivisible words',text:'Research ideas',available:2},
 {name:'Punctuation',text:'\u300a\u4e2d\u6587\u300b\uff0c\u5f88\u597d\uff01',available:4},
 {name:'Grapheme clusters',text:'\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66 \ud83d\ude80 e\u0301',available:3},
 {name:'Mixed languages',text:'English \u4e2d\u6587 2026 title',available:5},
 {name:'Single matrix',text:'$matrix$',available:1,math:true},
 {name:'Two formulas',text:'$matrix$ $fraction$',available:2,math:true},
 {name:'Formula mixed languages',text:'\u4e2d\u6587 $matrix$ English words',available:5,math:true},
 {name:'Short label precedence',text:conciseLabel({type:'text',text:'# ignored'} as never,'one two three four five'),available:5},
 {name:'First nonempty heading',text:conciseLabel({type:'text',text:'\n# one two three four five\nbody'} as never),available:5},
 {name:'Empty fallback',text:conciseLabel({type:'text',text:''} as never),available:1}
];
export async function phase16Preview() {
 const results=[];
 for(const theme of ['light','dark'])for(const type of ['text','group'])for(const sample of cases){
  if(type==='group'&&sample.math)continue;
  const section=document.createElement('section');section.className=theme;document.body.append(section);
  const heading=document.createElement('h2');heading.textContent=sample.name;section.append(heading);
  const parent=section.createDiv({cls:'smc-semantic-label'});parent.style.position='relative';parent.style.width='210px';parent.style.height='100px';
  const title=parent.createDiv({cls:'smc-fit-title'+(type==='group'?' smc-group-overview-title':'')});
  let renders=0;
  const api:MathAPI={load:async()=>{},finish:async()=>{},render(source){
   renders++;const ns='http://www.w3.org/1998/Math/MathML',math=document.createElementNS(ns,'math');
   const box=document.createElementNS(ns,source==='matrix'?'mtable':'mfrac');
   for(let i=0;i<2;i++){const row=document.createElementNS(ns,source==='matrix'?'mtr':'mi');if(source==='matrix'){const cell=document.createElementNS(ns,'mtd'),value=document.createElementNS(ns,'mn');value.textContent=String(i);cell.append(value);row.append(cell);}else row.textContent=String(i);box.append(row);}math.append(box);return math as unknown as HTMLElement;
  }};
  const labels=new AdaptiveLabels(api);
  const before=title.createDiv({cls:'smc-title-flow'});before.textContent=sample.text;
  for(let target=1;target<=5;target++){
   const start=performance.now();labels.prepare(title,sample.text,210,100,!!sample.math,target as 1);
   for(let i=0;i<6;i++)await Promise.resolve();labels.flush(.6);
   const elapsed=performance.now()-start,flow=title.querySelector<HTMLElement>('.smc-title-flow')!;
   const rows=Array.from(flow.children) as HTMLElement[],lines=countTitleLines(flow),expected=Math.min(target,sample.available);
   const a=parent.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(flow);
   const contained=Array.from(range.getClientRects()).every(r=>r.left>=a.left-.2&&r.right<=a.right+.2&&r.top>=a.top-.2&&r.bottom<=a.bottom+.2);
   const nonempty=rows.every(row=>row.textContent!.trim().length>0),noOverlap=rows.every((row,i)=>i===0||row.getBoundingClientRect().top>=rows[i-1]!.getBoundingClientRect().bottom-.1);
   // Independent visible block count and non-overlap assertions accompany logical line counting.
   const passed=lines===expected&&rows.length===expected&&nonempty&&noOverlap&&contained;
   results.push({theme,type,case:sample.name,target,expected,lines,contained,nonempty,noOverlap,elapsed,passed});
  }
  const count=renders;
  // Font change causes layout invalidation, not formula rerendering.
  const font=document.createElement('style');font.textContent='.smc-fit-title{font-family:monospace;letter-spacing:1px}';document.head.append(font);
  await Promise.resolve();labels.prepare(title,sample.text,210,100,!!sample.math,3);labels.flush(.6);
  results.push({case:'Font invalidation '+sample.name,theme,type,passed:countTitleLines(title.querySelector('.smc-title-flow')!)===Math.min(3,sample.available)&&renders===count});
  font.remove();await Promise.resolve();
  labels.prepare(title,sample.text,210,100,!!sample.math,'AUTO');labels.flush(.6);
  results.push({case:'Return to Auto '+sample.name,theme,type,passed:!title.querySelector('.smc-title-row')&&renders===count});
  labels.release(title);
 }
 // Side-by-side comparison with the actual released 0.1.1 layout code.
 for(const target of [1,2,3,4,5] as const){
  const section=document.createElement('section');section.className='light';document.body.prepend(section);
  const h=document.createElement('h2');h.textContent='Target '+target+' lines: 0.1.1 / Phase 16';section.append(h);
  const text='\u4e2d\u6587\u6807\u9898\u6392\u7248\u6548\u679c\u6bd4\u8f83';
  const make=()=>{const parent=section.createDiv({cls:'smc-semantic-label'});parent.style.position='relative';parent.style.width='210px';parent.style.height='55px';return parent.createDiv({cls:'smc-fit-title'});};
  const old=make(),oldFlow=old.createDiv({cls:'smc-title-flow'});oldFlow.textContent=text;
  const fits=oldLayout([{title:old,flow:oldFlow,width:210,height:55,lines:target}],.5);old.setCssProps({'--smc-label-scale':String(Math.min(fits.get(old)!,1.5))});
  const current=make(),labels=new AdaptiveLabels();labels.prepare(current,text,210,55,false,target);labels.flush(.5);
  const lines=countTitleLines(current.querySelector('.smc-title-flow')!);
  results.push({case:'0.1.1 comparison',target,oldLines:countTitleLines(oldFlow),newLines:lines,passed:lines===target});labels.release(current);
 }
 return results;
}
