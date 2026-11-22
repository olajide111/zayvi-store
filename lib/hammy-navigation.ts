import {HAMMY_PILOT,HAMMY_SAMPLE_PRODUCTS} from './hammy-pilot';
import {filterHammyProducts,type HammyFilters} from './hammy-shopping';
export type HammyRoute={view:'home'|'collection'|'product'|'bag';department?:string;product?:string;filters?:HammyFilters};
export type HammyQuery=Record<string,string|string[]|undefined>;
const scalar=(value:string|string[]|undefined)=>typeof value==='string'?value:'';
export function hammyDepartment(value:string|string[]|undefined){return HAMMY_PILOT.departments.find(item=>item===scalar(value));}
export function readHammyFilters(query:HammyQuery,department?:string):HammyFilters{
 const scope=filterHammyProducts(HAMMY_SAMPLE_PRODUCTS,department);
 const size=scalar(query.size),colour=scalar(query.colour),sort=scalar(query.sort),budget=scalar(query.budget);
 return {
  query:scalar(query.q).slice(0,80),
  size:scope.some(item=>item.sizes.includes(size))?size:'',
  colour:scope.some(item=>item.colours.includes(colour))?colour:'',
  sort:['low','high','name'].includes(sort)?sort:'featured',
  budget:['under30','under50'].includes(budget)?budget:'',
 };
}
export function hammyHref(view:HammyRoute['view'],department?:string,product?:string,filters:HammyFilters={}){
 const validDepartment=hammyDepartment(department);
 const q=new URLSearchParams({view});
 if(validDepartment)q.set('department',validDepartment);
 if(product)q.set('product',product.slice(0,100));
 const clean=readHammyFilters({q:filters.query,size:filters.size,colour:filters.colour,sort:filters.sort,budget:filters.budget},validDepartment);
 if(clean.query)q.set('q',clean.query);
 if(clean.size)q.set('size',clean.size);
 if(clean.colour)q.set('colour',clean.colour);
 if(clean.sort!=='featured')q.set('sort',clean.sort!);
 if(clean.budget)q.set('budget',clean.budget);
 return `/admin/pilots/hammy/preview?${q}`;
}

export function hammyFiltersFromSearchParams(params:Pick<URLSearchParams,'keys'|'getAll'>){
 const query:HammyQuery=Object.fromEntries([...new Set(params.keys())].map(key=>{
  const values=params.getAll(key);return [key,values.length===1?values[0]:values];
 }));
 return readHammyFilters(query,hammyDepartment(query.department));
}
