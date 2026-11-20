import type { TemplateFamily } from './storefront-theme';
export type StudioProduct = { id:string; name:string; image:string; price:number; currency:string; category:string; description:string };
export const DESIGN_PROFILE_KEY = 'zayvi-design-profile-v1';
export const DESIGN_DRAFT_KEY = 'zayvi-design-draft-v1';
export const BUSINESS_TYPES = ['Fashion','Beauty','Home','Electronics','Food','Trade','General retail','Art','Gifts','Lifestyle'] as const;
export type DesignProfile = { name:string; industry:string; style:'Signature'|'Expressive'|'Either' };
export const EMPTY_PROFILE:DesignProfile={name:'',industry:'General retail',style:'Either'};
export function parseDesignProfile(value:unknown):DesignProfile {
  const v=value&&typeof value==='object'?value as Record<string,unknown>:{};
  return {name:typeof v.name==='string'?v.name.slice(0,80):'', industry:BUSINESS_TYPES.includes(v.industry as typeof BUSINESS_TYPES[number])?String(v.industry):'General retail',style:v.style==='Signature'||v.style==='Expressive'?v.style:'Either'};
}
const photo=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;
const photos={fashion:photo('photo-1483985988355-763728e1935b'),beauty:photo('photo-1596462502278-27bfdc403348'),home:photo('photo-1616486338812-3dadae4b4ace'),tech:photo('photo-1498049794561-7780e7231661'),food:photo('photo-1542838132-92c53300491e'),art:photo('photo-1579783902614-a3fb3927b6a5'),bag:photo('photo-1553062407-98eeb64c6a62'),chair:photo('photo-1598300042247-d088f8ab3a91'),headphones:photo('photo-1505740420928-5e560c06d30e'),bottle:photo('photo-1602143407151-7111542de6e8')};
const catalogues:Record<TemplateFamily,Array<[string,string,number,string]>>={
 editorial:[['The everyday tote',photos.bag,48,'Accessories'],['Soft form collection',photos.fashion,85,'Clothing'],['Daily ritual',photos.beauty,32,'Care'],['The carry edit',photos.bag,64,'Accessories'],['Weekend layers',photos.fashion,72,'Clothing'],['Morning essentials',photos.beauty,28,'Care']],
 'general-commerce':[['The everyday tote',photos.bag,48,'Travel'],['Daily bottle',photos.bottle,24,'Essentials'],['Listening room',photos.headphones,90,'Technology'],['Reading chair',photos.chair,180,'Home'],['Daily ritual',photos.beauty,32,'Care'],['Weekend layers',photos.fashion,72,'Style']],
 'product-specification':[['Studio headphones',photos.headphones,120,'Audio'],['The workspace edit',photos.tech,240,'Workspace'],['Everyday audio',photos.headphones,85,'Audio'],['Desk essentials',photos.tech,64,'Accessories'],['Travel listening',photos.headphones,95,'Audio'],['Workday collection',photos.tech,180,'Workspace']],
 grocery:[['Seasonal greens',photos.food,8,'Fresh'],['The pantry selection',photos.food,16,'Pantry'],['Weekly essentials',photos.food,24,'Everyday'],['Kitchen collection',photos.food,12,'Pantry'],['Fresh selection',photos.food,9,'Fresh'],['The weekend basket',photos.food,28,'Everyday']],
 'home-furniture':[['The reading chair',photos.chair,180,'Seating'],['Room to unwind',photos.home,240,'Living'],['Quiet corner',photos.chair,210,'Seating'],['The home collection',photos.home,95,'Objects'],['Daily comforts',photos.home,64,'Textiles'],['A place to pause',photos.chair,190,'Seating']],
 wholesale:[['Workspace range',photos.tech,240,'Equipment'],['Carry collection',photos.bag,48,'Accessories'],['Audio collection',photos.headphones,120,'Equipment'],['Everyday range',photos.bottle,24,'Essentials'],['Home collection',photos.home,95,'Home'],['The seating range',photos.chair,180,'Home']],
};
export function demoProducts(family:TemplateFamily):StudioProduct[]{return catalogues[family].map(([name,image,price,category],i)=>({id:`demo-${i}`,name,image,price,currency:'GBP',category,description:'Demonstration content to help you explore this design. Replace it with your own product description, photography and verified details before publishing.'}));}
