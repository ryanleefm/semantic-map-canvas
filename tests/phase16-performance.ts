import { AdaptiveLabels } from '../src/rendering/AdaptiveLabels';
import { layoutLabels as previousLayout } from './phase16-baseline';
import type { TitleLines } from '../src/semantic/TitleLines';

export function phase16Performance() {
 const results=[],median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]!;
 for(const count of [300,1500])for(const mode of ['AUTO',3] as const){
  const initialOld:number[]=[],initialNew:number[]=[],changeOld:number[]=[],changeNew:number[]=[],zoom:number[]=[],steady:number[]=[];
  for(let repeat=0;repeat<3;repeat++)for(const version of ['0.1.1','phase16']){
   const root=document.createElement('div');root.style.position='absolute';root.style.left='-100000px';document.body.append(root);
   const rows=Array.from({length:count},(_,i)=>{const parent=root.createDiv({cls:'smc-semantic-label'});parent.style.width='500px';parent.style.height='300px';const title=parent.createDiv({cls:'smc-fit-title'}),flow=title.createDiv({cls:'smc-title-flow'});return {title,flow,text:(i%2?'Understanding semantic relationships between nodes':'\u8fd9\u662f\u4e00\u4e2a\u9700\u8981\u5b8c\u6574\u663e\u793a\u7684\u4e2d\u6587\u6807\u9898')+' '+i};});
   const labels=new AdaptiveLabels();
   const old=(lines:TitleLines)=>{const fits=previousLayout(rows.map(r=>({title:r.title,flow:r.flow,width:500,height:300,lines})),.3);for(const [title,fit]of fits)title.setCssProps({'--smc-label-scale':String(Math.min(fit,2.5))});};
   const start=performance.now();
   if(version==='0.1.1'){
    for(const r of rows)r.flow.textContent=r.text;old(mode);initialOld.push(performance.now()-start);
    const t=performance.now();old(5);changeOld.push(performance.now()-t);
   }else{
    for(const r of rows)labels.prepare(r.title,r.text,500,300,false,mode);labels.flush(.3);initialNew.push(performance.now()-start);
    let t=performance.now();for(const r of rows)labels.prepare(r.title,r.text,500,300,false,5);labels.flush(.3);changeNew.push(performance.now()-t);
    t=performance.now();for(let i=0;i<100;i++)labels.updateZoom(.1+i*.001);zoom.push((performance.now()-t)/100);
    t=performance.now();for(const r of rows)labels.prepare(r.title,r.text,500,300,false,5);labels.flush(.3);steady.push(performance.now()-t);
   }
   for(const r of rows)labels.release(r.title);root.remove();
  }
  results.push({case:'Phase16 browser performance',count,mode,initialOldMs:median(initialOld),initialNewMs:median(initialNew),changeAllToFiveOldMs:median(changeOld),changeAllToFiveNewMs:median(changeNew),zoomMs:median(zoom),steadyMs:median(steady),passed:true});
 }
 return results;
}
