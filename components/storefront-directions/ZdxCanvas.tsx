'use client';
import {useState} from 'react';
import type {DirectionFamily} from '@/lib/storefront-theme-directions';
import ZdxDirectionPreview from './ZdxDirectionPreview';
import './zdx-fonts.css';
export default function ZdxCanvas({family,device,screen}:{family:DirectionFamily;device:string;screen:string}){
 const [message,setMessage]=useState('');
 return <div onClickCapture={e=>{const b=(e.target as HTMLElement).closest('button');if(b&&/checkout|paypal|request a quote|reserve|pay now/i.test(b.textContent||'')){e.preventDefault();e.stopPropagation();setMessage('Design preview only. No payment, quote request or reservation was sent.');}}}><div style={{background:'#fff6df',color:'#57451d',font:'12px/1.5 Arial',padding:'8px 16px'}}>SAMPLE DESIGN · Placeholder artwork and sample prices · No real orders or payments</div>{message&&<div role="status" style={{position:'fixed',bottom:16,left:16,right:16,zIndex:9999,background:'#172c20',color:'white',padding:16,display:'flex',gap:20,justifyContent:'space-between'}}>{message}<button onClick={()=>setMessage('')} style={{minHeight:44,minWidth:80,border:'1px solid white',borderRadius:6}}>Dismiss</button></div>}<ZdxDirectionPreview family={family} device={device} screen={screen}/></div>;
}
