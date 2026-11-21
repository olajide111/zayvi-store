import {HAMMY_SAMPLE_PRODUCTS} from './hammy-pilot';
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
