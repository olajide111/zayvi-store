import {ALL_STUDIO_THEMES} from './theme-registry';
import type {StudioProduct} from './theme-studio';

// A design brief, not a tenant ID, active store context or live catalogue.
export const HAMMY_PILOT={
 name:'Hammy Store',industry:'General fashion',themeId:'atelier',
 headline:'Style for every generation.',
 colours:{canvas:'#FAFAFA',ink:'#181A20',accent:'#2846C8'},
 departments:['Women','Men','Kids','Baby'],
 status:'design-preview' as const,
};
export const HAMMY_THEME=ALL_STUDIO_THEMES.find(theme=>theme.id===HAMMY_PILOT.themeId)!;
const babyPhoto='https://images.unsplash.com/photo-1768693602418-260d828b878d?auto=format&fit=crop&w=1000&q=80';
const kidsPhoto='https://images.unsplash.com/photo-1777397660834-67c6d0eabe15?auto=format&fit=crop&w=1000&q=80';
const note='Demonstration catalogue entry and example GBP price. The editorial image may not show the exact garment. Sizes, materials, stock and selling countries must be supplied before this becomes a real product.';
export const HAMMY_SAMPLE_PRODUCTS:StudioProduct[]=[
 {id:'hammy-demo-women-denim',name:'Everyday denim edit',category:'Women',image:'/demo-photos/denim.webp',price:45},
 {id:'hammy-demo-men-layers',name:'Everyday outerwear edit',category:'Men',image:'/demo-photos/puffer.webp',price:65},
 {id:'hammy-demo-kids-layers',name:'Kids’ everyday edit',category:'Kids',image:kidsPhoto,price:28},
 {id:'hammy-demo-baby-soft',name:'Baby soft essentials',category:'Baby',image:babyPhoto,price:18},
 {id:'hammy-demo-women-occasion',name:'Occasionwear edit',category:'Women',image:'/demo-photos/textiles-display.webp',price:55},
 {id:'hammy-demo-men-denim',name:'Men’s denim edit',category:'Men',image:'/demo-photos/denim.webp',price:48},
 {id:'hammy-demo-kids-everyday',name:'Kids’ summer edit',category:'Kids',image:kidsPhoto,price:24},
 {id:'hammy-demo-baby-layers',name:'Baby layering edit',category:'Baby',image:babyPhoto,price:22},
].map(product=>({...product,currency:'GBP',description:note}));
