import { AdaptiveLabels } from '../src/rendering/AdaptiveLabels';
import type { MathAPI } from '../src/rendering/MathTitle';

export async function phase14Preview() {
 const results=[];
 for(const theme of ['light','dark']) {
  const section=document.createElement('section');section.className=theme;document.body.append(section);
  const parent=section.createDiv({cls:'smc-semantic-label'});
  parent.style.position='relative';parent.style.width='180px';parent.style.height='100px';
  const title=parent.createDiv({cls:'smc-fit-title'});
  const labels=new AdaptiveLabels();
  const text='Understanding semantic relationships between English words';
  labels.prepare(title,text,180,100);labels.flush(.5);
  let intact=true;const node=title.firstChild!;
  for(const match of text.matchAll(/[A-Za-z]+/g)) {
   const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
   if(range.getClientRects().length!==1)intact=false;
  }
  results.push({theme,case:'English whole words in narrow node',passed:intact});labels.release(title);
  let renders=0;
  // Native browser MathML validates formula layout, not the Obsidian MathJax API.
  const api:MathAPI={load:async()=>{},finish:async()=>{},render(source){
   renders++;const math=document.createElementNS('http://www.w3.org/1998/Math/MathML','math');
   const fraction=document.createElementNS(math.namespaceURI,'mfrac');
   for(const value of ['a+b','c+d']) {const row=document.createElementNS(math.namespaceURI,'mtext');row.textContent=source==='long'?'abcdefghij'.repeat(8):value;fraction.append(row);}
   math.append(fraction);return math as unknown as HTMLElement;
  }};
  const mathLabels=new AdaptiveLabels(api);
  for(const source of ['$fraction$','Text $long$ end']) {
   mathLabels.prepare(title,source,180,100,true);
   for(let i=0;i<6;i++)await Promise.resolve();
   mathLabels.flush(.5);
   const a=parent.getBoundingClientRect(),formula=title.querySelector('.smc-inline-math')!.getBoundingClientRect();
   const fitted=formula.left>=a.left&&formula.right<=a.right&&formula.top>=a.top&&formula.bottom<=a.bottom;
   const count=renders;
   mathLabels.prepare(title,source,100,60,true);mathLabels.flush(.4);mathLabels.updateZoom(.1);
   results.push({theme,case:'Browser MathML geometry '+source,passed:fitted&&renders===count});
  }
  mathLabels.release(title);
 }
 return results;
}
