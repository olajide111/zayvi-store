'use client';
import {useEffect,useState} from 'react';
import FooterSocialLinks from '@/components/FooterSocialLinks';
import type {ThemeMerchantContent} from '@/lib/theme-merchant-content';
export function useThemeMerchantContent(market:'GB'|'NG'|null){
 const [snapshot,setSnapshot]=useState<{market:string;data:ThemeMerchantContent|null}|null>(null);
 useEffect(()=>{if(!market)return;const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);let active=true;
 fetch(`/api/storefront/theme-content?market=${market}`,{cache:'no-store',signal:c.signal}).then(async r=>{if(!r.ok)throw new Error();const data=await r.json();if(data.market!==market)throw new Error();if(active)setSnapshot({market,data});}).catch(()=>{if(active)setSnapshot({market,data:null});}).finally(()=>clearTimeout(timer));return()=>{active=false;c.abort();clearTimeout(timer);};},[market]);
 return market&&snapshot?.market===market?snapshot.data:undefined;
}
export function MerchantStory({content,summary=false}:{content:ThemeMerchantContent|null|undefined;summary?:boolean}){
 if(content===undefined)return <p role="status">Loading published store story…</p>;
 if(!content||content.about.status==='unavailable')return <p role="status">Published store story is temporarily unavailable.</p>;
 if(content.about.status==='missing')return <p>No About page is published for this market yet. Publish one in Content publishing to preview it here.</p>;
 return <div><h2>{content.about.title}</h2><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{summary?content.about.body?.slice(0,320):content.about.body}</p></div>;
}
export function MerchantSocial({content}:{content:ThemeMerchantContent|null|undefined}){
 if(content===undefined)return <p role="status">Loading social profiles…</p>;
 if(!content||content.social.status==='unavailable')return <p role="status">Social profiles are temporarily unavailable.</p>;
 return <FooterSocialLinks links={content.social.links}/>;
}
