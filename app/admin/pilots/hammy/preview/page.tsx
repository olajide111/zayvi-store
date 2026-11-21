import HammyShop,{type HammyRoute} from '@/components/pilots/HammyShop';
import {HAMMY_PILOT} from '@/lib/hammy-pilot';
export default async function HammyPreview({searchParams}:{searchParams:Promise<{department?:string;view?:string;product?:string}>}){
 const query=await searchParams;
 const department=HAMMY_PILOT.departments.find(name=>name===query.department);
 const view=(['home','collection','product','bag'].includes(query.view||'')?query.view:department?'collection':'home') as HammyRoute['view'];
 return <HammyShop route={{view,department,product:query.product}}/>;
}
