'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {RefinedProduct} from './zdx-refined-data';

export function freshDropFlight(source:{left:number;top:number;width:number;height:number},basket:{left:number;top:number;width:number;height:number},viewportWidth:number){
 const width=viewportWidth<600?176:208,height=width*5/6;
 const startX=source.left+source.width/2-width/2,startY=source.top+source.height/2-height/2;
 const endX=basket.left+basket.width/2-width/2,mouthY=basket.top+basket.height*.4;
 const hoverY=mouthY-height*.94,dropY=mouthY-height*.35;
 const transform=(x:number,y:number,scale:number,rotation:number)=>`translate(${x}px,${y}px) scale(${scale}) rotate(${rotation}deg)`;
 return {width,height,duration:1050,frames:[
  {transform:transform(startX,startY,.96,-3),opacity:1,clipPath:'inset(0 0 0 0)',offset:0},
  {transform:transform(startX,startY-36,1.08,-10),opacity:1,clipPath:'inset(0 0 0 0)',offset:.16},
  {transform:transform(startX+(endX-startX)*.55,Math.min(startY,hoverY)-70,1.04,7),opacity:1,clipPath:'inset(0 0 0 0)',offset:.55},
  {transform:transform(endX,hoverY,.98,0),opacity:1,clipPath:'inset(0 0 0 0)',offset:.8},
  {transform:transform(endX,dropY,.94,0),opacity:1,clipPath:'inset(0 0 100% 0)',offset:1},
 ]};
}
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
  const mouth=target.querySelector<HTMLElement>('[data-fresh-basket-mouth]')||target;
  const flight=freshDropFlight(source.getBoundingClientRect(),mouth.getBoundingClientRect(),window.innerWidth);
  const ghost=document.createElement('div');
  ghost.setAttribute('aria-hidden','true');ghost.dataset.freshFlying='true';
  Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',width:`${flight.width}px`,height:`${flight.height}px`,zIndex:'2147483000',pointerEvents:'none',willChange:'transform,opacity',filter:'drop-shadow(0 10px 10px #0002)'});
  if(illustration){const clone=illustration.cloneNode(true) as SVGElement;clone.setAttribute('aria-hidden','true');clone.removeAttribute('role');clone.style.width='100%';clone.style.height='100%';ghost.append(clone);}else return;
  container.append(ghost);ghosts.current.add(ghost);
  const animation=ghost.animate(flight.frames,{duration:flight.duration,easing:'linear',fill:'forwards'});
  track(animation);
  animation.finished.then(()=>{if(freshMotionAllowed(container,enabled)&&target.isConnected)track(mouth.animate([{transform:'translateY(0) scale(1)'},{transform:'translateY(5px) scale(1.12,.9)',offset:.35},{transform:'translateY(-3px) scale(.98,1.06)',offset:.7},{transform:'translateY(0) scale(1)'}],{duration:350,easing:'ease-out'}));}).catch(()=>{}).finally(()=>{ghost.remove();ghosts.current.delete(ghost);});
 };
 return {root,enabled,setEnabled,fly};
}
