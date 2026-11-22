import type {HammyBagLine} from './hammy-shopping';
export type HammyShoppingFlow={quickProductId:string|null;basketOpen:boolean;receipt:HammyBagLine|null};
export type HammyShoppingAction=
 |{type:'quick-view';productId:string}|{type:'close-quick'}
 |{type:'add-success';line:HammyBagLine}|{type:'open-basket'}|{type:'close-basket'}
 |{type:'dismiss-receipt'}|{type:'route-change'};
export const initialHammyShoppingFlow:HammyShoppingFlow={quickProductId:null,basketOpen:false,receipt:null};
export function hammyShoppingFlow(state:HammyShoppingFlow,action:HammyShoppingAction):HammyShoppingFlow{
 switch(action.type){
  case 'quick-view':return {quickProductId:action.productId,basketOpen:false,receipt:null};
  case 'close-quick':return {...state,quickProductId:null};
  case 'add-success':return {quickProductId:null,basketOpen:false,receipt:{...action.line}};
  case 'open-basket':return {quickProductId:null,basketOpen:true,receipt:null};
  case 'close-basket':return {...state,basketOpen:false};
  case 'dismiss-receipt':return {...state,receipt:null};
  case 'route-change':return initialHammyShoppingFlow;
 }
}
