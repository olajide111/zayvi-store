'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import type {ThemeDesign} from '@/lib/theme-designs';
import s from './demo.module.css';
const sizes={phone:[390,844],tablet:[820,1180],laptop:[1366,900]} as const;
export default function ThemeDemo({theme,query}:{theme:ThemeDesign;query:string}){
 const [device,setDevice]=useState<keyof typeof sizes>('laptop'),[landscape,setLandscape]=useState(false),[fit,setFit]=useState(true),[area,setArea]=useState([1400,900]);
 const stage=useRef<HTMLDivElement>(null);useEffect(()=>{const el=stage.current;if(!el)return;const observer=new ResizeObserver(([e])=>setArea([e.contentRect.width,e.contentRect.height]));observer.observe(el);return()=>observer.disconnect();},[]);
 const native=sizes[device],w=landscape?native[1]:native[0],h=landscape?native[0]:native[1],scale=fit?Math.min(1,Math.max(.1,(area[0]-40)/(w+24)),Math.max(.1,(area[1]-40)/(h+24))):1;
 const src=`/admin/themes/${theme.id}/preview?${query}`;
 return <main className={s.demo}><header><Link href="/admin/themes">All themes</Link><strong>{theme.name} · Live demo</strong><Link href={`/admin/themes/${theme.id}`}>Open design studio</Link></header><div className={s.toolbar}><div role="group" aria-label="Device preview">{Object.keys(sizes).map(d=><button key={d} aria-pressed={device===d} onClick={()=>{setDevice(d as keyof typeof sizes);setLandscape(false);}}>{d==='phone'?'Phone':d==='tablet'?'Tablet':'Laptop'}</button>)}</div><button aria-pressed={landscape} onClick={()=>setLandscape(v=>!v)}>Rotate</button><button aria-pressed={fit} onClick={()=>setFit(v=>!v)}>{fit?'Fit to screen':'Actual size'}</button><span>{w} × {h} · {Math.round(scale*100)}%</span><a href={src} target="_blank" rel="noopener noreferrer">Open without frame ↗</a></div><div className={s.stage} ref={stage}><div style={{width:(w+24)*scale,height:(h+24)*scale,flexShrink:0}}><div className={s.device} data-device={device} style={{width:w+24,height:h+24,transform:`scale(${scale})`}}><iframe title={`${theme.name} ${device} shopping demo`} src={src} style={{width:w,height:h}}/></div></div></div><footer>Try navigation, search, products and the preview bag. No orders or payments. Device frames simulate screen size; they do not replace testing on real devices.</footer></main>;
}
