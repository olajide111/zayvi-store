/** A zero-based, evenly spaced axis with human-readable steps. */
export function chartScale(values:number[],integer=false){
 const peak=Math.max(0,...values.filter(Number.isFinite));
 const rough=(peak||1)/4,unit=10**Math.floor(Math.log10(rough));
 const candidate=[1,2,2.5,5,10].map(n=>n*unit).find(n=>n>=rough)??unit*10;
 const step=integer?Math.max(1,Math.ceil(candidate)):Math.max(.01,candidate);
 const count=Math.max(1,Math.ceil((peak||1)/step));
 return {max:count*step,ticks:Array.from({length:count+1},(_,i)=>Number((i*step).toPrecision(12)))};
}
export function chartDateIndices(length:number,narrow=false){
 if(length<=0)return [];
 const count=Math.min(length,narrow?3:6);
 if(count===1)return [0];
 return Array.from({length:count},(_,i)=>Math.round(i*(length-1)/(count-1)));
}
