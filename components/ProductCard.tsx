'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {StorefrontProduct} from '@/lib/storefront-products';
import {productPath} from '@/lib/storefront-market';
import s from './original.module.css';
type Props={product:StorefrontProduct;onView:(p:StorefrontProduct)=>void;onAdd:(p:StorefrontProduct,qty?:number,color?:string,size?:string)=>void};
export default function ProductCard({product:p,onView,onAdd}:Props){
 const [failed,setFailed]=useState(false),options=p.colors.length>0||p.sizes.length>0;
 const price=new Intl.NumberFormat(p.marketCode==='NG'?'en-NG':'en-GB',{style:'currency',currency:p.currency||(p.marketCode==='NG'?'NGN':'GBP')}).format(Number(p.price));
 return <article className={s.card}><div className={s.photo}><Link href={productPath(p.id,p.marketCode)} aria-label={`View ${p.name}`}>{p.image&&!failed?<img src={p.image} alt={p.name} loading="lazy" onError={()=>setFailed(true)}/>:<div className={s.placeholder}>Image unavailable · {p.name}</div>}</Link><button className={s.quick} onClick={()=>onView(p)} aria-label={`Quick view ${p.name}`}>Quick view ↗</button></div><div className={s.cardInfo}><span className={s.categoryLabel}>{p.category}</span><Link className={s.productName} href={productPath(p.id,p.marketCode)}>{p.name}</Link><div className={s.cardBottom}><span className={s.price}>{price}</span><button onClick={()=>options?onView(p):onAdd(p,1)} aria-label={`${options?'Choose options for':'Add to preview cart:'} ${p.name}`}>{options?'Choose options':'Add to cart +'}</button></div><p className={s.note}>Preview catalogue · No live purchase</p></div></article>;
}
