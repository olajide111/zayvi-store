'use client';
import CatalogueImage from './CatalogueImage';
import type {StorefrontProduct} from '@/lib/storefront-products';
import s from './original.module.css';
export default function CategoryGrid({onSelect,products=[]}:{onSelect:(category:string)=>void;products?:StorefrontProduct[]}){
 const categories=[...new Set(products.map(p=>p.category).filter(Boolean))];
 if(!categories.length)return null;
 return <section className={s.section} aria-labelledby="original-categories"><div className={s.sectionHead}><div><p className={s.eyebrow}>FIND YOUR EVERYDAY</p><h2 id="original-categories">A good place to start.</h2><p className={s.muted}>Explore what’s in the collection, one category at a time.</p></div></div><div className={s.categories}>{categories.map(category=>{const matching=products.filter(p=>p.category===category);const image=matching.find(p=>p.image)?.image;return <button key={category} className={s.category} onClick={()=>onSelect(category)}>{image&&<CatalogueImage src={image} alt="" fallback={category} loading="lazy"/>}<div><span>{category}<small>{matching.length} {matching.length===1?'product':'products'}</small></span><span aria-hidden="true">↗</span></div></button>;})}</div></section>;
}
