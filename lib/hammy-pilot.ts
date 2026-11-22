import {ALL_STUDIO_THEMES} from './theme-registry';
import type {StudioProduct} from './theme-studio';

// A design brief, not a tenant ID, active store context or live catalogue.
export const HAMMY_PILOT={
 name:'Hammy Store',industry:'General fashion',themeId:'atelier',
 headline:'Style for every generation.',
 colours:{canvas:'#F7F8FB',ink:'#171B29',accent:'#2846C8'},
 departments:['Women','Men','Kids','Baby','Sportswear','Footwear','Accessories','Traditional'],
 status:'design-preview' as const,
};
export const HAMMY_THEME=ALL_STUDIO_THEMES.find(theme=>theme.id===HAMMY_PILOT.themeId)!;
const babyPhoto='https://images.unsplash.com/photo-1768693602418-260d828b878d?auto=format&fit=crop&w=1000&q=80';
const kidsPhoto='https://images.unsplash.com/photo-1777397660834-67c6d0eabe15?auto=format&fit=crop&w=1000&q=80';
const note='Demonstration catalogue entry and example GBP price. The editorial image may not show the exact garment. Sizes, materials, stock and selling countries must be supplied before this becomes a real product.';
export type HammyProduct=StudioProduct&{images:string[];sizes:string[];colours:string[];department:string;kind:string};
const shirt='https://images.unsplash.com/photo-1722310752951-4d459d28c678?auto=format&fit=crop&w=1200&q=80';
const sports='https://images.unsplash.com/photo-1774414489812-f863c5bd32f4?auto=format&fit=crop&w=1200&q=80';
const shoes='https://images.unsplash.com/photo-1637437757614-6491c8e915b5?auto=format&fit=crop&w=1200&q=80';
const shoeDetail='https://images.unsplash.com/photo-1637437735621-22472eee4875?auto=format&fit=crop&w=1200&q=80';
export const HAMMY_SAMPLE_PRODUCTS:HammyProduct[]=[
 {id:'hammy-demo-women-denim',name:'Everyday denim edit',category:'Women',image:'/demo-photos/denim.webp',price:45},
 {id:'hammy-demo-men-layers',name:'Everyday outerwear edit',category:'Men',image:'/demo-photos/puffer.webp',price:65},
 {id:'hammy-demo-kids-layers',name:'Kids’ everyday edit',category:'Kids',image:kidsPhoto,price:28},
 {id:'hammy-demo-baby-soft',name:'Baby soft essentials',category:'Baby',image:babyPhoto,price:18},
 {id:'hammy-demo-women-occasion',name:'Occasionwear edit',category:'Women',image:'/demo-photos/textiles-display.webp',price:55},
 {id:'hammy-demo-men-denim',name:'Men’s denim edit',category:'Men',image:'/demo-photos/denim.webp',price:48},
 {id:'hammy-demo-kids-everyday',name:'Kids’ summer edit',category:'Kids',image:kidsPhoto,price:24},
 {id:'hammy-demo-baby-layers',name:'Baby layering edit',category:'Baby',image:babyPhoto,price:22},
 {id:'hammy-demo-sports',name:'Activewear edit',category:'Sportswear',image:sports,price:38},
 {id:'hammy-demo-sports-tee',name:'Training essentials',category:'Sportswear',image:shirt,price:24},
 {id:'hammy-demo-trainers',name:'Running trainers',category:'Footwear',image:shoes,price:62},
 {id:'hammy-demo-accessory',name:'Everyday accessories edit',category:'Accessories',image:'/demo-photos/textiles-detail.webp',price:16},
 {id:'hammy-demo-traditional',name:'Traditional occasion edit',category:'Traditional',image:'/demo-photos/textiles-display.webp',price:75},
 {id:'hammy-demo-tee',name:'Everyday cotton tee',category:'Men',image:shirt,price:22},
].map(product=>({...product,currency:'GBP',description:note,
 department:['Women','Men','Kids','Baby'].includes(product.category)?product.category:product.id==='hammy-demo-sports'?'Women':product.id==='hammy-demo-sports-tee'?'Men':'All',
 kind:['Sportswear','Footwear','Accessories','Traditional'].includes(product.category)?product.category:'Everyday',
 images:product.category==='Footwear'?[shoes,shoeDetail]:product.category==='Baby'?[product.image,kidsPhoto]:product.category==='Kids'?[product.image,babyPhoto]:product.category==='Traditional'||product.category==='Accessories'?[product.image,'/demo-photos/textiles-detail.webp','/demo-photos/textiles-display.webp']:[product.image,shirt],
 sizes:product.category==='Baby'?['0–3 months','3–6 months','6–12 months']:product.category==='Kids'?['2–3 years','4–5 years','6–7 years','8–10 years','11–13 years']:product.category==='Footwear'?['UK 4','UK 5','UK 6','UK 7','UK 8','UK 9']:product.category==='Accessories'?['One size']:['XS','S','M','L','XL','XXL'],
 colours:product.category==='Footwear'?['Blue / white']:product.category==='Baby'||product.category==='Kids'?['Natural','Blue']:['As pictured','Black'],
}));
