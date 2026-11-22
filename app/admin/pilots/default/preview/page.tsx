import DefaultStoreShop from '@/components/pilots/DefaultStoreShop';
import {defaultStoreDepartment,readDefaultStoreFilters,type DefaultStoreRoute,type DefaultStoreQuery} from '@/lib/default-store-navigation';
export default async function DefaultStorePreview({searchParams}:{searchParams:Promise<DefaultStoreQuery>}){
 const query=await searchParams;
 const department=defaultStoreDepartment(query.department);
 const view=(typeof query.view==='string'&&['home','collection','product','bag'].includes(query.view)?query.view:department?'collection':'home') as DefaultStoreRoute['view'];
 const product=typeof query.product==='string'?query.product.slice(0,100):undefined;
 return <DefaultStoreShop route={{view,department,product,filters:readDefaultStoreFilters(query,department)}}/>;
}
