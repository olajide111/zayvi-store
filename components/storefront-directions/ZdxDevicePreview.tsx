'use client';
import ThemeIcon from "../themes/ThemeIcon";
import {useState,useRef,useEffect} from 'react';
import Link from 'next/link';
import type {DirectionFamily} from '@/lib/storefront-theme-directions';
import s from './zdx-device.module.css';
export default function ZdxDevicePreview({family,name}:{family:DirectionFamily;name:string}){
 const [device,setDevice]=useState('desktop'),[fit,setFit]=useState(true),[width,setWidth]=useState(1500),[revision,setRevision]=useState(0),[screen,setScreen]=useState('home');const stage=useRef<HTMLDivElement>(null);
 useEffect(()=>{const e=stage.current;if(!e)return;const o=new ResizeObserver(([v])=>setWidth(v.contentRect.width));o.observe(e);return()=>o.disconnect();},[]);
 const native=device==='mobile'?390:1440,scale=fit?Math.min(1,Math.max(.15,(width-32)/native)):1;const height=device==='mobile'?844:900;
 const src=`/admin/themes/directions/${family}/canvas?device=${device}&screen=${screen}`;
 return <main className={s.page}><header><div><Link href="/admin/themes/directions">All additional directions</Link><h1>{name}</h1></div><Link href="/admin/themes">Existing themes</Link></header><div className={s.tools}><button aria-pressed={device==='desktop'} onClick={()=>setDevice('desktop')}>Desktop · 1440</button><button aria-pressed={device==='mobile'} onClick={()=>setDevice('mobile')}>Mobile · 390</button><button aria-pressed={fit} onClick={()=>setFit(v=>!v)}>{fit?'Fit to window':'Actual size'}</button><label>Start at <select value={screen} onChange={e=>setScreen(e.target.value)}>{['home','collection','product','bag'].map(v=><option key={v}>{v}</option>)}</select></label><button onClick={()=>setRevision(v=>v+1)}>Restart sample</button><a href={src} target="_blank" rel="noopener noreferrer">{"Open full page "}<ThemeIcon name="external"/></a></div><p className={s.notice}>Design review with supplied placeholder art and explicit sample GBP/NGN prices. No real sellers, stock, slots, orders or payments. Device/start-screen changes restart the sample.</p><div className={s.stage} ref={stage}><div style={{width:native*scale,height:height*scale,flexShrink:0}}><iframe key={revision} src={src} title={`${name} ${device} design review`} style={{width:native,height,transform:`scale(${scale})`,transformOrigin:'top left'}}/></div></div><footer>Source: supplied desktop/mobile boards. Publishing, seller plans and real catalogue integration are not connected. Owner review required before merge.</footer></main>;
}
