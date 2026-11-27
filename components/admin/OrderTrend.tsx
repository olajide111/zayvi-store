'use client';
import {dailyOrderSeries,type AnalyticsReport} from '@/lib/analytics-report';
import DailyMetricChart from './DailyMetricChart';
const count=(value:number)=>new Intl.NumberFormat('en-GB').format(value);
export default function OrderTrend({data}:{data:AnalyticsReport}){
 const points=data.markets.length?dailyOrderSeries(data).map(p=>({day:p.day,value:p.orders})):[];
 return <DailyMetricChart seriesKey={`${data.trendFrom}:${data.period.to}:${data.filters.market}`} title="Orders over time" subtitle="Order volume · daily · UTC" points={points} kind="bars" formatValue={count} formatTick={value=>new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(value)}
  caption={data.filters.range==='all'?'Recorded orders · last 90 days':'Recorded orders in selected period'} legend="Orders" tableLabel="View daily figures"
  description="Order counts across selected markets, grouped by order creation date. No currencies are combined. Includes all recorded order statuses; this is not a paid-order count."/>;
}
