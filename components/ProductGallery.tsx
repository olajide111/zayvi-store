'use client';
import {useState} from 'react';
import {productGallerySources} from '@/lib/product-gallery';
export default function ProductGallery({image,images,name}:{image:string;images?:string[];name:string}){
 const sources=productGallerySources(image,images);
 const [index,setIndex]=useState(0),[failed,setFailed]=useState<string[]>([]);
 const selected=Math.max(0,Math.min(index,sources.length-1)),src=sources[selected];
 function step(delta:number){setIndex((selected+delta+sources.length)%sources.length);}
 return <figure className="m-0 min-w-0" aria-label={`${name} product gallery`}>
  <div className="aspect-square overflow-hidden rounded-xl bg-white" onKeyDown={event=>{if(sources.length>1&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}}}>
   {src&&!failed.includes(src)?<img src={src} alt={`${name}, image ${selected+1} of ${sources.length}`} className="h-full w-full object-contain" decoding="async" onError={()=>setFailed(current=>[...current,src])}/>:<p className="grid h-full place-items-center p-6 text-center text-sm text-slate-600">Image unavailable · {name}</p>}
  </div>
  {sources.length>1&&<><div className="my-3 flex items-center justify-center gap-4"><button className="h-11 min-w-11 rounded-full border border-slate-300" aria-label={`Previous image of ${name}`} onClick={()=>step(-1)}>←</button><span role="status" className="text-xs text-slate-600">{selected+1} / {sources.length}</span><button className="h-11 min-w-11 rounded-full border border-slate-300" aria-label={`Next image of ${name}`} onClick={()=>step(1)}>→</button></div><div className="flex gap-2 overflow-x-auto p-1" aria-label="Choose a product image">{sources.map((url,i)=><button key={url} onClick={()=>setIndex(i)} aria-label={`View ${name} image ${i+1}`} aria-pressed={selected===i} className={`h-20 w-16 shrink-0 overflow-hidden rounded border-2 ${selected===i?'border-slate-900':'border-transparent'}`}><img src={url} alt="" loading="lazy" className="h-full w-full object-contain"/></button>)}</div></>}
 </figure>;
}
