'use client';

import type { StudioProduct } from '@/lib/theme-studio';
import CatalogueImage from '@/components/CatalogueImage';
import s from '@/components/original.module.css';
import palette from './original-theme.module.css';

type Props = {
  products: StudioProduct[];
  headline: string;
  onOpen: (product: StudioProduct) => void;
  onAdd: (product: StudioProduct) => void;
  onBrowse: (category?: string) => void;
};

/** Original's product montage and category-led shopping, with the studio's safe preview bag. */
export default function OriginalThemeHome({ products, headline, onOpen, onAdd, onBrowse }: Props) {
  const categories = [...new Set(products.map(product => product.category).filter(Boolean))];
  const price = (product: StudioProduct) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: product.currency }).format(product.price);
  return <div className={palette.original}>
    <section className={s.hero}>
      <div><p className={s.eyebrow}>EVERYDAY, CONSIDERED</p><h1>{headline || 'Good finds. For real life.'}</h1><p className={s.intro}>Useful pieces. A little more character. Explore the things that make your everyday feel more like you.</p><div className={s.actions}><button className={s.primary} onClick={() => onBrowse()}>Explore all products ↗</button><button className={s.secondary} onClick={() => document.getElementById('original-current-edit')?.scrollIntoView({ behavior: 'instant' })}>Discover the current edit</button></div></div>
      <div className={s.stage} aria-label="A first look at the collection">{products.slice(0, 3).map((product, index) => <button key={product.id} className={`${s.object} ${index === 0 ? s.feature : ''}`} onClick={() => onOpen(product)}><CatalogueImage src={product.image} alt={product.name} fallback={product.name} /><span>{product.name} ↗</span></button>)}{!products.length && <div className={s.empty}>Your collection starts with your products.</div>}</div>
    </section>
    {!!categories.length && <section className={s.section} aria-labelledby="original-departments"><div className={s.sectionHead}><div><p className={s.eyebrow}>FIND YOUR EVERYDAY</p><h2 id="original-departments">A good place to start.</h2></div></div><div className={s.categories}>{categories.map(category => {
      const matching = products.filter(product => product.category === category);
      return <button className={s.category} key={category} onClick={() => onBrowse(category)}><CatalogueImage src={matching.find(product => product.image)?.image || ''} alt="" fallback={category} loading="lazy" /><div><span>{category}<small>{matching.length} {matching.length === 1 ? 'product' : 'products'}</small></span><span aria-hidden="true">↗</span></div></button>;
    })}</div></section>}
    <section className={s.section} id="original-current-edit" aria-labelledby="original-edit-heading"><div className={s.sectionHead}><div><p className={s.eyebrow}>TAKE A CLOSER LOOK</p><h2 id="original-edit-heading">The current edit.</h2></div><button className={s.secondary} onClick={() => onBrowse()}>View all products</button></div><div className={s.productGrid}>{products.slice(0, 4).map(product => <article key={product.id} className={s.card}><button className={s.photo} onClick={() => onOpen(product)} aria-label={`View ${product.name}`}><CatalogueImage src={product.image} alt={product.name} fallback={product.name} loading="lazy" /></button><div className={s.cardInfo}><span className={s.categoryLabel}>{product.category}</span><button className={s.productName} onClick={() => onOpen(product)}>{product.name}</button><div className={s.cardBottom}><span className={s.price}>{price(product)}</span><button onClick={() => onAdd(product)}>Add to preview bag</button></div></div></article>)}</div>{!products.length && <p>No publicly available products in this market.</p>}</section>
  </div>;
}
