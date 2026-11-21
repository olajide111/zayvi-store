'use client';
import type {StorefrontProduct} from '@/lib/storefront-products';
import ProductCard from './ProductCard';
import s from './original.module.css';
type Props={products:StorefrontProduct[];onView:(p:StorefrontProduct)=>void;onAdd:(p:StorefrontProduct,qty?:number,color?:string,size?:string)=>void};
export default function BestSellers({products,onView,onAdd}:Props){if(!products.length)return null;return <section className={s.section}><div className={s.sectionHead}><div><p className={s.eyebrow}>MEET THE COLLECTION</p><h2>The current edit.</h2><p className={s.muted}>A first look at what’s available to explore in your market.</p></div></div><div className={s.productGrid}>{products.slice(0,4).map(p=><ProductCard key={p.id} product={p} onView={onView} onAdd={onAdd}/>)}</div></section>;}
