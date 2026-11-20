import { ZDX_SAMPLE_PRODUCTS, type ZdxMarket, type ZdxSampleProduct } from './zdx-sample-data';
export type MarketBagLine = { id: string; quantity: number };
export type MarketFilters = { query: string; department: string; seller: string; sort: string };
export const marketPrice = (p: ZdxSampleProduct, market: ZdxMarket) => market === 'NG' ? p.priceNgn : p.priceGbp;
export function marketProducts(filters: MarketFilters, market: ZdxMarket) {
 const words = filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const products = ZDX_SAMPLE_PRODUCTS.filter(p => (filters.department === 'All' || p.department === filters.department) && (filters.seller === 'All' || p.seller === filters.seller) && words.every(word => `${p.name} ${p.department} ${p.seller} ${p.description}`.toLowerCase().includes(word)));
 return [...products].sort((a,b) => filters.sort === 'low' ? marketPrice(a,market)-marketPrice(b,market) : filters.sort === 'high' ? marketPrice(b,market)-marketPrice(a,market) : filters.sort === 'name' ? a.name.localeCompare(b.name) : 0);
}
export function changeMarketBag(bag: MarketBagLine[], id: string, delta: number): MarketBagLine[] {
 if (!ZDX_SAMPLE_PRODUCTS.some(p=>p.id===id) || !Number.isInteger(delta)) return bag;
 const quantity = (bag.find(line=>line.id===id)?.quantity || 0) + delta;
 const rest = bag.filter(line=>line.id!==id);
 return quantity > 0 ? [...rest, {id,quantity}] : rest;
}
export function marketBagSummary(bag: MarketBagLine[], market: ZdxMarket) {
 const groups = new Map<string, {product: ZdxSampleProduct; quantity: number}[]>();
 let total=0, count=0;
 for(const line of bag){const product=ZDX_SAMPLE_PRODUCTS.find(p=>p.id===line.id);if(!product || !Number.isInteger(line.quantity) || line.quantity<=0)continue;total+=marketPrice(product,market)*line.quantity;count+=line.quantity;groups.set(product.seller,[...(groups.get(product.seller)||[]),{product,quantity:line.quantity}]);}
 return {total,count,groups:[...groups.entries()]};
}
