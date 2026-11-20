"use client";
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { Monitor, Smartphone, RotateCcw, Search, ShoppingBag, Check } from 'lucide-react';
import AdminPageHeading, { adminAction } from '@/components/admin/AdminPageHeading';
import { PRODUCTS } from '@/lib/products';
import { THEME_DESIGNS, type ThemeDesign } from '@/lib/theme-designs';
import styles from './themes.module.css';

type Motion = 'off' | 'subtle' | 'expressive';
const industries = [...new Set(THEME_DESIGNS.flatMap(theme => theme.industries))].sort();
function themeStyle(theme: ThemeDesign): CSSProperties {
  return { '--canvas':theme.canvas, '--ink':theme.ink, '--accent':theme.accent, '--accent-ink':theme.accentInk, '--heading':theme.serif ? 'Georgia, serif' : 'var(--font-geist-sans), Arial, sans-serif' } as CSSProperties;
}
function DesignSample({ theme, miniature=false, motion='off', onBrowse, onAdd }: { theme:ThemeDesign; miniature?:boolean; motion?:Motion; onBrowse?:()=>void; onAdd?:()=>void }) {
  const [imageFailed,setImageFailed]=useState(false);
  return <div className={styles.sample} style={themeStyle(theme)} data-layout={theme.layout} data-mini={miniature} data-motion={motion}>
    <div className={styles.sampleNav}><span>ZAYVI / {theme.name}</span><span>THE COLLECTION</span></div>
    {theme.layout==='catalogue' && <div className={styles.departments}><span>All products</span><span>Travel</span><span>Daily essentials</span></div>}
    <div className={styles.hero}><div className={styles.copy}><p className={styles.eyebrow}>THE EVERYDAY COLLECTION</p><h3>{theme.headline}</h3><p className={styles.detail}>Discover the collection from a fresh perspective.</p>{miniature ? <span className={styles.cta}>Explore collection</span> : <button type="button" onClick={onBrowse} className={styles.cta}>Explore collection</button>}</div>
      <div className={styles.stage}><div className={styles.shape} aria-hidden="true" />{imageFailed ? <span>Product image</span> : <img onError={()=>setImageFailed(true)} src={PRODUCTS[0].image} alt={miniature ? '' : PRODUCTS[0].name} loading="lazy" className={styles.productImage}/>}<span className={styles.caption}>AeroBottle / Everyday collection</span></div>
    </div>
    {!miniature && <div className={styles.sampleProducts}>{PRODUCTS.slice(0,3).map(product=><div key={product.id} className={styles.productCard}><p>{product.name}</p><span>Sample product</span><button type="button" className={styles.add} onClick={onAdd} aria-label={`Try adding ${product.name} to the sample bag`}>Try add to bag</button></div>)}</div>}
  </div>;
}
export default function AdminThemesPage() {
  const [selectedId,setSelectedId]=useState('atelier');
  const [collection,setCollection]=useState('All');
  const [industry,setIndustry]=useState('All');
  const [query,setQuery]=useState('');
  const [device,setDevice]=useState<'desktop'|'mobile'>('desktop');
  const [motion,setMotion]=useState<Motion>('subtle');
  const [replay,setReplay]=useState(0);
  const [bag,setBag]=useState(0);
  const [notice,setNotice]=useState('');
  const theme=THEME_DESIGNS.find(item=>item.id===selectedId)!;
  const filtered=THEME_DESIGNS.filter(item=>(collection==='All'||item.collection===collection)&&(industry==='All'||item.industries.includes(industry))&&`${item.name} ${item.description} ${item.industries.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  function selectTheme(id:string) {setSelectedId(id);setBag(0);setNotice('');setReplay(value=>value+1);}
  return <main className="min-h-screen">
    <AdminPageHeading section="Storefront" title="Find your store’s signature." description="Explore distinctive layouts, expressive motion and a style that feels like you."><Link href="/" prefetch={false} target="_blank" rel="noopener noreferrer" className={adminAction}>Open current storefront</Link></AdminPageHeading>
    <div className={styles.workspace}>
      <div className={styles.intro}><div><span className={styles.kicker}>THE ZAYVI THEME COLLECTION</span><h2>Different by design.</h2><p>From quiet luxury to something wonderfully unexpected. Twelve design concepts, six industry starting points.</p></div><div className={styles.status}>Design studio preview<p>Selections affect this sample only. Publishing to your store is not available yet.</p></div></div>
      <div className={styles.studio}>
        <section aria-label="Theme gallery" className={styles.gallery}>
          <div className={styles.filters}><label className={styles.search}><Search size={18} aria-hidden="true"/><span className="sr-only">Search themes</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find your style"/></label><label className={styles.filterLabel}>Industry<select value={industry} onChange={event=>setIndustry(event.target.value)}><option value="All">All industries</option>{industries.map(item=><option key={item}>{item}</option>)}</select></label></div>
          <div className={styles.tabs} aria-label="Theme collections">{['All','Signature','Expressive'].map(item=><button key={item} type="button" aria-pressed={collection===item} onClick={()=>setCollection(item)}>{item}</button>)}</div>
          <p className={styles.count} role="status">{filtered.length} design{filtered.length===1?'':'s'} · {theme.name} selected</p>
          <div className={styles.cards}>{filtered.map(item=><button key={item.id} type="button" className={styles.themeCard} aria-pressed={selectedId===item.id} onClick={()=>selectTheme(item.id)} aria-label={`Preview ${item.name}: ${item.description}`}><div className={styles.thumbnail} aria-hidden="true"><DesignSample theme={item} miniature/></div><div className={styles.cardBody}><div><h3>{item.name}</h3>{item.id===selectedId&&<Check size={18} aria-hidden="true"/>}</div><p>{item.description}</p><span>{item.collection} collection</span></div></button>)}</div>
          {!filtered.length&&<div className={styles.empty}><h3>No styles match those filters.</h3><button type="button" onClick={()=>{setQuery('');setIndustry('All');setCollection('All');}}>Clear filters</button></div>}
        </section>
        <section className={styles.preview} aria-label="Selected theme preview">
          <div className={styles.previewHeading}><div><span className={styles.kicker}>{theme.collection} COLLECTION</span><h2>{theme.name}</h2></div><div className={styles.devices}><button type="button" aria-label="Desktop preview" aria-pressed={device==='desktop'} onClick={()=>setDevice('desktop')}><Monitor size={19}/></button><button type="button" aria-label="Mobile preview" aria-pressed={device==='mobile'} onClick={()=>setDevice('mobile')}><Smartphone size={19}/></button></div></div>
          <div className={styles.toolbar}><label>Motion<select value={motion} onChange={event=>{setMotion(event.target.value as Motion);setReplay(value=>value+1);}}><option value="off">Off</option><option value="subtle">Subtle</option><option value="expressive">Expressive</option></select></label><button type="button" disabled={motion==='off'} onClick={()=>setReplay(value=>value+1)}><RotateCcw size={15}/>Replay</button><span><ShoppingBag size={16} aria-hidden="true"/>Sample bag: {bag}</span></div>
          <div className={styles.previewCanvas}><div className={styles.deviceFrame} data-device={device} key={`${theme.id}-${motion}-${replay}`}><DesignSample theme={theme} motion={motion} onBrowse={()=>setNotice('Collection preview: the sample products below demonstrate this design. Your live catalogue is unchanged.')} onAdd={()=>{setBag(value=>value+1);setNotice('Added to the sample bag. No order or payment was created.');}}/></div></div>
          <p className={styles.notice} role="status">{notice||'Try the sample collection and bag. This preview uses demonstration products.'}</p>
          <div className={styles.previewNotes}><p>{theme.description}</p><p>Suggested for {theme.industries.join(', ')}. Motion respects the shopper’s reduced-motion preference. No scroll hijacking or looping effects.</p></div>
        </section>
      </div>
    </div>
  </main>;
}
