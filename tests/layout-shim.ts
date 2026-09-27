/** Linkedom does not lay out text. Real fit checks live in the browser suite. */
export function installLayoutShim(document: any): void {
  const prototype = document.defaultView.HTMLElement.prototype;
  if (typeof document.body.offsetWidth === 'number') return;
  Object.defineProperty(prototype, 'offsetWidth', {configurable:true,get(){
    return Math.ceil(parseFloat(this.style.getPropertyValue('--smc-label-width')) || 128);
  }});
  Object.defineProperty(prototype, 'scrollWidth', {configurable:true,get(){return this.offsetWidth;}});
  Object.defineProperty(prototype, 'offsetHeight', {configurable:true,get(){
    const lines=(this.textContent||'').split('\n').reduce((sum:number,line:string)=>sum+Math.max(1,Math.ceil(line.length*32*.65/this.offsetWidth)),0);
    return Math.ceil(lines*32*1.4);
  }});
  Object.defineProperty(prototype, 'scrollHeight', {configurable:true,get(){return this.offsetHeight;}});
}
