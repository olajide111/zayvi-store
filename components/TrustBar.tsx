import Link from 'next/link';
import {contentUrl,type ContentMarket} from '@/lib/storefront-content';
import s from './original.module.css';
export default function TrustBar({market='GB'}:{market?:ContentMarket}){return <section className={s.policy} aria-label="Shopping information">{[{slug:'shipping',title:'Delivery, explained',text:'Check the details for your market.'},{slug:'returns',title:'A clear returns policy',text:'Read the process before you decide.'},{slug:'contact',title:'A little help, when you need it',text:'Find the right place to ask a question.'}].map(item=><div key={item.slug}><Link href={contentUrl(market,item.slug)}>{item.title} ↗</Link><p>{item.text}</p></div>)}</section>;}
