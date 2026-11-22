import {parseSocialLinks,type SocialLinks} from './social-links';
export type ThemeMerchantContent={market:'GB'|'NG';about:{status:'published'|'missing'|'unavailable';title?:string;body?:string};social:{status:'ready'|'unavailable';links:SocialLinks}};
type Result={ok:boolean;status:number;data:unknown};
export function themeMerchantContent(market:'GB'|'NG',about:Result,social:Result):ThemeMerchantContent{
 const entry=(about.data as {entry?:{title?:unknown;body?:unknown}}|null)?.entry;
 const published=about.ok&&typeof entry?.title==='string'&&typeof entry?.body==='string';
 let links:SocialLinks={},socialReady=false;
 if(social.ok){try{links=parseSocialLinks((social.data as {links?:unknown}|null)?.links);socialReady=true;}catch{}}
 return {market,about:published?{status:'published',title:entry!.title as string,body:entry!.body as string}:{status:about.status===404?'missing':'unavailable'},social:{status:socialReady?'ready':'unavailable',links}};
}
