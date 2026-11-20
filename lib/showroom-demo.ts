import type {StudioProduct} from './theme-studio';
// Original sample artwork. No stock, supplier or product claims.
export const SHOWROOM_DEMO_PRODUCTS:StudioProduct[]=[
 ['storm','Storm blue','Outerwear',85],['ember','Ember orange','Outerwear',85],['moss','Moss green','Everyday',72],['chalk','Chalk white','Everyday',72],['midnight','Midnight navy','Outerwear',95],['rose','Dusty rose','Everyday',72],
].map(([id,colour,category,price])=>({id:`showroom-${id}`,name:`${colour} studio jacket`,image:`/demo-garments/${id}.svg`,price:Number(price),currency:'GBP',category:String(category),description:'Original Zayvi sample garment illustration. Demo price only: this is not available for purchase and has no stock or supplier. Explore the design, open product details and try the preview bag.'}));
