export type OrderState={paymentStatus:string;fulfilmentStatus:string;orderStatus?:string};
export type OrderQueue='all'|'review'|'payment'|'closed';
export function orderQueue(order:OrderState):Exclude<OrderQueue,'all'>{
 if(order.orderStatus==='cancelled'||['refunded','partially_refunded'].includes(order.paymentStatus)||['fulfilled','cancelled'].includes(order.fulfilmentStatus))return 'closed';
 if(order.paymentStatus!=='paid')return 'payment';
 return 'review';
}
export function orderNextAction(order:OrderState){
 if(order.orderStatus==='cancelled')return {title:'View cancellation',detail:'Review the order and payment history.'};
 if(['refunded','partially_refunded'].includes(order.paymentStatus))return {title:'Review refund',detail:'Check provider refund and return records.'};
 if(order.fulfilmentStatus==='fulfilled')return {title:'View delivery',detail:'Review dispatch and tracking details.'};
 if(order.paymentStatus!=='paid')return {title:'Review payment',detail:'Payment must be confirmed before fulfilment.'};
 return {title:'Review fulfilment',detail:'Check stock, supplier and delivery plan. Preview cannot dispatch.'};
}
