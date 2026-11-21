import Link from 'next/link';
import {contentUrl,type ContentMarket} from '@/lib/storefront-content';
import s from './original.module.css';
/** Guidance replaces the unconnected newsletter form until subscriptions are implemented. */
export default function Newsletter({market='GB'}:{market?:ContentMarket}){return <section className={s.support}><div className={s.supportInner}><div><p className={s.eyebrow}>A MORE CONSIDERED WAY TO SHOP</p><h2>Good questions.<br/>Clear answers.</h2><p className={s.muted}>Know the delivery and returns details, explore our guides, or get in touch before you decide.</p></div><div className={s.supportLinks}><Link href={contentUrl(market,'shipping')}>Delivery information ↗</Link><Link href={contentUrl(market,'returns')}>Returns & cancellations ↗</Link><Link href={contentUrl(market,'contact')}>Contact Zayvi ↗</Link></div></div></section>;}
