'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {RefinedProduct} from './zdx-refined-data';

/** Motion is decorative: basket state never depends on animation completion. */
export function freshMotionAllowed(root:HTMLElement|null,localEnabled=true){
 return Boolean(root&&localEnabled&&!root.closest('.zdx-motion-off')&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
export function useFreshShoppingMotion(active:boolean){
 const root=useRef<HTMLDivElement>(null);
 const [enabled,setEnabled]=useState(true);
 const animations=useRef(new Set<Animation>()),ghosts=useRef(new Set<HTMLElement>());
 const stop=useCallback(()=>{for(const a of animations.current)a.cancel();animations.current.clear();for(const node of ghosts.current)node.remove();ghosts.current.clear();},[]);
 useEffect(()=>{
  if(!active)return;
  if(!enabled)stop();
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const onPreference=()=>{if(!freshMotionAllowed(root.current,enabled))stop();};
  media.addEventListener('change',onPreference);
  const observer=new MutationObserver(onPreference);
  const studio=root.current?.closest('.zdx-responsive');
  if(studio)observer.observe(studio,{attributes:true,attributeFilter:['class']});
  return()=>{media.removeEventListener('change',onPreference);observer.disconnect();stop();};
 },[active,enabled,stop]);
 const track=(animation:Animation)=>{animations.current.add(animation);animation.finished.catch(()=>{}).finally(()=>animations.current.delete(animation));};
 const fly=(product:RefinedProduct,from:HTMLElement)=>{
  if(!active||from.closest('dialog[open]')||!freshMotionAllowed(root.current,enabled)||typeof from.animate!=='function')return;
  const container=root.current!;
  const targets=Array.from(container.querySelectorAll<HTMLElement>('[data-fresh-basket-target]'));
  const visible=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<window.innerHeight&&r.bottom>0&&r.left<window.innerWidth&&r.right>0;};
  const target=targets.find(el=>el.closest('dialog[open]')&&visible(el))||targets.filter(visible).at(-1);
  if(!target)return;
  // Bound decorative work during rapid taps; every tap still updates the basket.
  if(ghosts.current.size>=5)return;
  const nearby=from.closest<HTMLElement>('[data-fresh-item]');
  const sample=nearby?.dataset.freshItem===product.id?nearby:container.querySelector(`[data-fresh-item="${product.id}"]`);
  const illustration=sample?.querySelector<SVGElement>('svg[role="img"]');
  const source=illustration&&visible(illustration)?illustration:from;
  const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
  const startX=a.left+a.width/2-48,startY=a.top+a.height/2-40,endX=b.left+b.width/2-48,endY=b.top+b.height/2-40;
  const ghost=document.createElement('div');
  ghost.setAttribute('aria-hidden','true');ghost.dataset.freshFlying='true';
  Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',width:'96px',height:'80px',zIndex:'2147483000',pointerEvents:'none',willChange:'transform,opacity',filter:'drop-shadow(0 10px 10px #0002)'});
  if(illustration){const clone=illustration.cloneNode(true) as SVGElement;clone.setAttribute('aria-hidden','true');clone.removeAttribute('role');clone.style.width='100%';clone.style.height='100%';ghost.append(clone);}else return;
  container.append(ghost);ghosts.current.add(ghost);
  const animation=ghost.animate([
   {transform:`translate(${startX}px,${startY}px) scale(1) rotate(-8deg)`,opacity:1},
   {transform:`translate(${startX+(endX-startX)*.48}px,${Math.min(startY,endY)-75}px) scale(.82) rotate(8deg)`,opacity:1,offset:.48},
   {transform:`translate(${endX}px,${endY}px) scale(.22) rotate(0deg)`,opacity:.1},
  ],{duration:650,easing:'cubic-bezier(.25,.6,.35,1)',fill:'forwards'});
  track(animation);
  animation.finished.then(()=>{if(freshMotionAllowed(container,enabled)&&target.isConnected)track(target.animate([{transform:'scale(1)'},{transform:'scale(1.07)'},{transform:'scale(1)'}],{duration:250,easing:'ease-out'}));}).catch(()=>{}).finally(()=>{ghost.remove();ghosts.current.delete(ghost);});
 };
 return {root,enabled,setEnabled,fly};
}
