// Default Store v1 baseline. Maintain independently from Hammy.
import {DEFAULT_STORE_PILOT,DEFAULT_STORE_SAMPLE_PRODUCTS} from './default-store-pilot';
import {filterDefaultStoreProducts,type DefaultStoreFilters} from './default-store-shopping';
export type DefaultStoreRoute={view:'home'|'collection'|'product'|'bag';department?:string;product?:string;filters?:DefaultStoreFilters};
export type DefaultStoreQuery=Record<string,string|string[]|undefined>;
const scalar=(value:string|string[]|undefined)=>typeof value==='string'?value:'';
export function defaultStoreDepartment(value:string|string[]|undefined){return DEFAULT_STORE_PILOT.departments.find(item=>item===scalar(value));}
export function readDefaultStoreFilters(query:DefaultStoreQuery,department?:string):DefaultStoreFilters{
 const scope=filterDefaultStoreProducts(DEFAULT_STORE_SAMPLE_PRODUCTS,department);
 const size=scalar(query.size),colour=scalar(query.colour),sort=scalar(query.sort),budget=scalar(query.budget);
 return {
  query:scalar(query.q).slice(0,80),
  size:scope.some(item=>item.sizes.includes(size))?size:'',
  colour:scope.some(item=>item.colours.includes(colour))?colour:'',
  sort:['low','high','name'].includes(sort)?sort:'featured',
  budget:['under30','under50'].includes(budget)?budget:'',
 };
}
export function defaultStoreHref(view:DefaultStoreRoute['view'],department?:string,product?:string,filters:DefaultStoreFilters={}){
 const validDepartment=defaultStoreDepartment(department);
 const q=new URLSearchParams({view});
 if(validDepartment)q.set('department',validDepartment);
 if(product)q.set('product',product.slice(0,100));
 const clean=readDefaultStoreFilters({q:filters.query,size:filters.size,colour:filters.colour,sort:filters.sort,budget:filters.budget},validDepartment);
 if(clean.query)q.set('q',clean.query);
 if(clean.size)q.set('size',clean.size);
 if(clean.colour)q.set('colour',clean.colour);
 if(clean.sort!=='featured')q.set('sort',clean.sort!);
 if(clean.budget)q.set('budget',clean.budget);
 return `/admin/pilots/default/preview?${q}`;
}

export function defaultStoreFiltersFromSearchParams(params:Pick<URLSearchParams,'keys'|'getAll'>){
 const query:DefaultStoreQuery=Object.fromEntries([...new Set(params.keys())].map(key=>{
  const values=params.getAll(key);return [key,values.length===1?values[0]:values];
 }));
 return readDefaultStoreFilters(query,defaultStoreDepartment(query.department));
}
