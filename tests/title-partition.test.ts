import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balancedBreaks } from '../src/rendering/TitlePartition';
import { collectTitleUnits, textUnits } from '../src/rendering/TitleUnits';
import { fixture } from './visibility.test';

test('balanced partition reaches every feasible row count and matches exhaustive optimum',()=>{
 let seed=7;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let n=1;n<=10;n++)for(let sample=0;sample<10;sample++){
  const widths=Array.from({length:n},()=>.1+Math.floor(random()*40));
  for(let requested=1;requested<=5;requested++){
   const k=Math.min(requested,n),breaks=balancedBreaks(widths,requested);assert.equal(breaks.length,k);assert.equal(breaks.at(-1),n);
   let last=0,cost=0;for(const end of breaks){assert.ok(end>last);cost+=widths.slice(last,end).reduce((a,b)=>a+b,0)**2;last=end;}
   const brute=(from:number,rows:number):number=>{if(rows===1)return widths.slice(from).reduce((a,b)=>a+b,0)**2;let best=Infinity,sum=0;for(let end=from+1;end<=n-rows+1;end++){sum+=widths[end-1]!;best=Math.min(best,sum*sum+brute(end,rows-1));}return best;};
   assert.ok(Math.abs(cost-brute(0,k))<1e-6,JSON.stringify({widths,k,breaks,cost}));
  }
 }
 assert.deepEqual(balancedBreaks([],3),[]);
 assert.equal(balancedBreaks(Array(10000).fill(1),5).length,5);
});
test('legal units preserve English words, Chinese punctuation and grapheme clusters',async()=>{
 const f=await fixture(),flow=f.root.createDiv({cls:'smc-title-flow'});
 const text="Research ideas \u300a\u7814\u7a76\u300b\uff0c\u4e2d\u6587 \ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66 e\u0301";
 flow.textContent=text;const units=collectTitleUnits(flow,s=>Array.from(s).length*32);
 assert.equal(units.flatMap(u=>u.parts).join(''),text);
 assert.ok(units.some(u=>u.parts.join('').trim()==='Research'));
 assert.ok(textUnits(text).includes('\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66'));
 for(const u of units){const t=u.parts.join('').trim();assert.ok(!/^[\u300b\uff0c]/.test(t));assert.ok(!/[\u300a]$/.test(t));}
 flow.textContent='Research';assert.equal(collectTitleUnits(flow,s=>s.length*20).length,1);
 flow.textContent='a'.repeat(100);assert.equal(collectTitleUnits(flow,s=>s.length*20).length,100);
});
