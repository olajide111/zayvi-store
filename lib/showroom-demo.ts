import type {StudioProduct} from './theme-studio';
// Photographs are editorial demo assets, not seller stock or 3D models.
export const SHOWROOM_DEMO_PRODUCTS:StudioProduct[]=[
 {id:'photo-puffer',name:'Puffer jacket study',category:'Outerwear',price:85,image:'/demo-photos/puffer.webp',credit:'Erik Mclean',photo:'https://unsplash.com/photos/black-bubble-jacket-on-hanger-jo6IYbEnQ58'},
 {id:'photo-denim',name:'Denim jacket study',category:'Denim',price:72,image:'/demo-photos/denim.webp',credit:'kemal alkan',photo:'https://unsplash.com/photos/blue-washed-jacket-hanging-on-white-door-_BDBEP0ePQc'},
].map(p=>({...p,currency:'GBP',description:`Real photograph by ${p.credit} on Unsplash, used as demonstration content. Demo price only: not available for purchase, not seller stock and not a rotatable 3D garment.`}));
