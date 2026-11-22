export type AnalyticsMarket={marketCode:string;currency:string;orderCount:number;paidOrders:number;paidValue:number;
  refundedOrderValue:number;paidAverageOrderValue:number|null};
export type AnalyticsCounts={total:number;paid:number;pending:number;unpaid:number;failed:number;partiallyRefunded:number;refunded:number;awaitingFulfilment:number;cancelled:number};
export type AnalyticsReport={schemaVersion:2;source:string;generatedAt:string;scope:string;filters:{range:string;market:string};
  period:{from:string|null;to:string;timezone:string};orders:AnalyticsCounts;markets:AnalyticsMarket[];
  previous:{orders:AnalyticsCounts;markets:AnalyticsMarket[]}|null;trendFrom:string;
  daily:{day:string;marketCode:string;currency:string;orderCount:number;paidOrders:number;paidValue:number}[];
  recentOrders:{id:string;orderNumber:string;marketCode:string;currency:string;total:number;paymentStatus:string;fulfilmentStatus:string;createdAt:string}[];
  measurement:{basis:string;paidValue:string;refunds:string;trafficAvailable:boolean;campaignAttributionAvailable:boolean;profitAvailable:boolean}};
export function percentageChange(current:number,previous:number):number|null{return previous>0?(current-previous)/previous*100:null;}
/** Count orders across markets; never combine currency amounts. */
export function dailyOrderSeries(report:Pick<AnalyticsReport,'trendFrom'|'period'|'daily'>){
  const start=new Date(report.trendFrom),end=new Date(report.period.to);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>end)throw new Error('Invalid analytics period.');
  const totals=new Map<string,number>();
  for(const row of report.daily)totals.set(row.day,(totals.get(row.day)||0)+row.orderCount);
  const points:{day:string;orders:number}[]=[],cursor=new Date(start.toISOString().slice(0,10)+'T00:00:00Z');
  while(cursor<=end&&points.length<92){const day=cursor.toISOString().slice(0,10);points.push({day,orders:totals.get(day)||0});cursor.setUTCDate(cursor.getUTCDate()+1);}
  return points;
}
export function analyticsCsv(report:AnalyticsReport){
  const cell=(value:unknown)=>{const text=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';};
  const rows:unknown[][]=[['Period start (UTC)',report.period.from||'All time'],['Period end (UTC)',report.period.to],
    ['Basis',report.measurement.basis],['Paid value definition',report.measurement.paidValue],
    ['Market','Currency','Orders','Currently paid orders','Currently paid order value','Average currently paid order value','Refunded-order value (not refund amount)'],
    ...report.markets.map(m=>[m.marketCode,m.currency,m.orderCount,m.paidOrders,m.paidValue,m.paidAverageOrderValue,m.refundedOrderValue])];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function growthActions(report:AnalyticsReport){
  const c=report.orders;
  return [
    {key:'payment',count:c.unpaid+c.pending,title:'Review unpaid orders',detail:'Check payment state before contacting a customer. These are recorded orders, not measured abandoned carts.',href:'/admin/orders',action:'Review orders'},
    {key:'service',count:c.awaitingFulfilment,title:'Check paid orders awaiting fulfilment',detail:'Resolve allocation and delivery issues. Preview test payments remain blocked from real fulfilment.',href:'/admin/orders',action:'Open orders'},
    {key:'failure',count:c.failed,title:'Investigate failed payments',detail:'Review the payment attempt before offering another checkout.',href:'/admin/payments',action:'Review payments'},
    {key:'returns',count:c.refunded+c.partiallyRefunded,title:'Learn from refunded orders',detail:'Review sizing, product and delivery issues. Order value is not the actual amount refunded.',href:'/admin/returns',action:'Review returns'},
  ].filter(item=>item.count>0);
}
