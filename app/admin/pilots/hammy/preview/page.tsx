import HammyShop from '@/components/pilots/HammyShop';
import {hammyDepartment,readHammyFilters,type HammyRoute,type HammyQuery} from '@/lib/hammy-navigation';
export default async function HammyPreview({searchParams}:{searchParams:Promise<HammyQuery>}){
 const query=await searchParams;
 const department=hammyDepartment(query.department);
 const view=(typeof query.view==='string'&&['home','collection','product','bag'].includes(query.view)?query.view:department?'collection':'home') as HammyRoute['view'];
 const product=typeof query.product==='string'?query.product.slice(0,100):undefined;
 return <HammyShop route={{view,department,product,filters:readHammyFilters(query,department)}}/>;
}
