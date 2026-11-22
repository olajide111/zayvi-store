import type {OrderQueue} from './order-work-queue';
export type OrderRouteFilters={queue:OrderQueue;payment:string;fulfilment:string;orderState:string;currency:string};
export const EMPTY_ORDER_FILTERS:OrderRouteFilters={queue:'all',payment:'all',fulfilment:'all',orderState:'all',currency:'all'};
const choices={queue:['all','review','payment','closed'],payment:['all','unpaid','pending','paid','failed','partially_refunded','refunded'],
  fulfilment:['all','unfulfilled','processing','fulfilled','cancelled'],orderState:['all','draft','pending_payment','confirmed','cancelled','completed'],currency:['all','GBP','NGN']};
/** Share only workflow filters, never a customer name/email/phone search. */
export function readOrderRouteFilters(params:URLSearchParams):OrderRouteFilters{
  const result={...EMPTY_ORDER_FILTERS};
  for(const key of Object.keys(choices) as (keyof OrderRouteFilters)[]){
    const values=params.getAll(key),value=values.length===1?values[0]:undefined;
    if(value&&choices[key].includes(value))Object.assign(result,{[key]:value});
  }
  return result;
}
export function orderFiltersHref(filters:Partial<OrderRouteFilters>={}){
  const params=new URLSearchParams();
  for(const key of Object.keys(choices) as (keyof OrderRouteFilters)[]){const value=filters[key];if(value&&value!=='all'&&choices[key].includes(value))params.set(key,value);}
  return '/admin/orders'+(params.size?'?'+params.toString():'');
}
