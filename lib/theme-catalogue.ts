import type {StudioProduct} from './theme-studio';
/** Preview only: retain explicit server market prices; never convert currencies. */
export function themeCatalogue(value:unknown):StudioProduct[]{
 if(!value||typeof value!=='object')throw new Error('Invalid catalogue response.');
 const payload=value as Record<string,unknown>;
 if(!['GB','NG'].includes(String(payload.market))||!Array.isArray(payload.products))throw new Error('Missing catalogue market.');
 const currency=payload.market==='NG'?'NGN':'GBP';
 if(payload.currency!==currency)throw new Error('Catalogue currency does not match its market.');
 return payload.products.flatMap((value:unknown)=>{
  if(!value||typeof value!=='object')return [];
  const p=value as Record<string,unknown>;
  if(typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim()||p.currency!==currency||p.marketCode!==payload.market||typeof p.price!=='number'||!Number.isFinite(p.price)||p.price<0)return [];
  const image=typeof p.image==='string'&&(/^https:\/\//i.test(p.image)||/^\/(?!\/)/.test(p.image))?p.image:'';
  return [{id:p.id,name:p.name,image,price:p.price,currency,category:typeof p.category==='string'?p.category:'Collection',description:typeof p.longDesc==='string'?p.longDesc:typeof p.desc==='string'?p.desc:''}];
 });
}
