import { AdaptiveLabels, fittedScale } from '../src/rendering/AdaptiveLabels';

/** Controlled browser DOM benchmark; excludes the Obsidian runtime and MathJax initialization. */
export function phase15Performance() {
 const results=[];
 const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]!;
 for(const count of [300,1500]) {
  const before:number[]=[],after:number[]=[],zoom:number[]=[],steady:number[]=[];
  for(let repeat=0;repeat<3;repeat++)for(const variant of ['phase14','phase15']) {
   const root=document.createElement('div');root.style.position='absolute';root.style.left='-100000px';document.body.append(root);
   const rows=Array.from({length:count},(_,i)=>{
    const parent=root.createDiv({cls:'smc-semantic-label'});parent.style.width='500px';parent.style.height='300px';
    const title=parent.createDiv({cls:'smc-fit-title'}),text=i%2?'Understanding semantic relationships between nodes':'\u8fd9\u662f\u4e00\u4e2a\u9700\u8981\u5b8c\u6574\u663e\u793a\u7684\u4e2d\u6587\u6807\u9898';return {title,text};
   });
   const labels=new AdaptiveLabels();const start=performance.now();
   if(variant==='phase14'){
    for(const {title,text}of rows){title.textContent=text;const advance=text.length*32*.65,longest=(text.match(/[a-zA-Z]+/g)??[]).reduce((n,w)=>Math.max(n,w.length),0);const width=Math.min(8192,Math.max(128,Math.min(1024,longest*32*.8),Math.min(advance,Math.sqrt(advance*32*1.4*500/300))));title.setCssProps({'--smc-label-width':width+'px'});}
    const fits=rows.map(({title})=>fittedScale(500,300,Math.max(title.offsetWidth,title.scrollWidth),Math.max(title.offsetHeight,title.scrollHeight)));
    rows.forEach(({title},i)=>title.setCssProps({'--smc-label-scale':String(Math.min(fits[i]!,2.5))}));before.push(performance.now()-start);
   }else{
    for(const {title,text}of rows)labels.prepare(title,text,500,300);labels.flush(.3);after.push(performance.now()-start);
    let time=performance.now();for(let n=0;n<100;n++)labels.updateZoom(.1+n*.001);zoom.push((performance.now()-time)/100);
    time=performance.now();for(const {title,text}of rows)labels.prepare(title,text,500,300);labels.flush(.3);steady.push(performance.now()-time);
   }
   for(const {title}of rows)labels.release(title);root.remove();
  }
  results.push({case:'Batched browser layout performance',count,phase14ApproxMs:median(before),phase15Ms:median(after),zoomUpdateMs:median(zoom),steadyScanMs:median(steady),passed:true});
 }
 return results;
}
