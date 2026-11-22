import {HAMMY_SAMPLE_PRODUCTS,type HammyProduct} from './hammy-pilot';
export type HammyBagLine={productId:string;size:string;colour:string;qty:number};
export const HAMMY_BAG_KEY='zayvi-hammy-demo-bag-v1';
export function bagKey(line:Omit<HammyBagLine,'qty'>){return JSON.stringify([line.productId,line.size,line.colour]);}
export function validHammyLine(value:unknown):HammyBagLine|null{
 if(!value||typeof value!=='object')return null;
 const line=value as HammyBagLine,product=HAMMY_SAMPLE_PRODUCTS.find(item=>item.id===line.productId);
 if(!product||!product.sizes.includes(line.size)||!product.colours.includes(line.colour)||!Number.isSafeInteger(line.qty)||line.qty<1||line.qty>10)return null;
 return {productId:product.id,size:line.size,colour:line.colour,qty:line.qty};
}
export function readHammyBag(value:unknown):HammyBagLine[]{
 if(!Array.isArray(value))return [];
 const unique=new Map<string,HammyBagLine>();
 for(const item of value.slice(0,100)){const line=validHammyLine(item);if(line)unique.set(bagKey(line),line);}
 return [...unique.values()];
}
export function addHammyLine(bag:HammyBagLine[],line:HammyBagLine):HammyBagLine[]{
 const valid=validHammyLine(line);if(!valid)throw new Error('Choose an available size and colour before adding to basket.');
 const key=bagKey(valid),existing=bag.find(item=>bagKey(item)===key);
 if((existing?.qty||0)+valid.qty>10)throw new Error('The demo limit is 10 of each size and colour.');
 return existing?bag.map(item=>bagKey(item)===key?{...item,qty:item.qty+valid.qty}:item):[...bag,valid];
}
export function hammyGallery(images:string[]){return [...new Set(images.filter(url=>/^https:\/\//.test(url)||/^\/(?!\/)/.test(url)))].slice(0,20);}

export type HammyFilters={query?:string;size?:string;colour?:string;budget?:string;sort?:string};
export function filterHammyProducts(products:HammyProduct[],department:string|undefined,filters:HammyFilters={}){
 const query=(filters.query||'').trim().toLowerCase();
 const ceiling=filters.budget==='under30'?30:filters.budget==='under50'?50:Infinity;
 return products.filter(product=>(!department||product.category===department||product.department===department)
  &&`${product.name} ${product.category} ${product.department}`.toLowerCase().includes(query)
  &&(!filters.size||product.sizes.includes(filters.size))
  &&(!filters.colour||product.colours.includes(filters.colour))&&product.price<=ceiling)
  .sort((a,b)=>filters.sort==='low'?a.price-b.price:filters.sort==='high'?b.price-a.price:filters.sort==='name'?a.name.localeCompare(b.name):0);
}
export function relatedHammyProducts(product:HammyProduct,limit=4){
 return HAMMY_SAMPLE_PRODUCTS.filter(item=>item.id!==product.id)
  .map((item,index)=>({item,index,score:(item.category===product.category?4:0)+(item.department===product.department&&item.department!=='All'?2:0)}))
  .sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,limit).map(entry=>entry.item);
}

/** Change only a known line's options; quantities and product identity come from the basket. */
export function updateHammyVariant(bag:HammyBagLine[],key:string,size:string,colour:string):HammyBagLine[]{
 const original=bag.find(line=>bagKey(line)===key);
 if(!original)throw new Error('This item is no longer in your basket.');
 const changed=validHammyLine({...original,size,colour});
 if(!changed)throw new Error('Choose an available size and colour.');
 if(bagKey(changed)===key)return bag;
 const remaining=bag.filter(line=>bagKey(line)!==key);
 // Reuse the same quantity cap and merge rules as adding from the product page.
 if(remaining.some(line=>bagKey(line)===bagKey(changed)))return addHammyLine(remaining,changed);
 return bag.map(line=>bagKey(line)===key?changed:line);
}
