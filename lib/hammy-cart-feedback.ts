type Rect={left:number;top:number;width:number;height:number};
/** Keep the confirmation thumbnail on-screen even when the product photo is above the fold. */
export function hammyFlightPath(source:Rect,target:Rect,viewport:{width:number;height:number}){
 const width=104,height=124;
 const clamp=(value:number,max:number)=>Math.min(Math.max(8,value),Math.max(8,max));
 const from={x:clamp(source.left+source.width/2-width/2,viewport.width-width-8),y:clamp(source.top+source.height/2-height/2,viewport.height-height-8)};
 const to={x:clamp(target.left+target.width/2-width/2,viewport.width-width-8),y:clamp(target.top+target.height/2-height/2,viewport.height-height-8)};
 return {from,to};
}
