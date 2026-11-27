'use client';
import {useState} from 'react';
import {dailyPaidValueSeries,type AnalyticsReport} from '@/lib/analytics-report';
import DailyMetricChart from './DailyMetricChart';
import s from './daily-metric-chart.module.css';
const money=(value:number,currency:string,compact=false)=>new Intl.NumberFormat(currency==='NGN'?'en-NG':'en-GB',{style:'currency',currency,...(compact?{notation:'compact' as const,maximumFractionDigits:2}:{})}).format(value);
export default function SalesValueChart({data}:{data:AnalyticsReport}){
 const markets=data.markets.map(m=>({key:`${m.marketCode}:${m.currency}`,code:m.marketCode,currency:m.currency}));
 const [choice,setChoice]=useState('');
 const market=markets.find(m=>m.key===choice)||markets[0];
 const points=market?dailyPaidValueSeries(data,market.code,market.currency):[];
 return <DailyMetricChart seriesKey={`${market?.key}:${data.trendFrom}:${data.period.to}`} title="Sales value over time" subtitle="Paid order value · daily · UTC" points={points}
  formatValue={value=>money(value,market?.currency||'GBP')} formatTick={value=>money(value,market?.currency||'GBP',true)}
  caption={data.filters.range==='all'?'Paid order value · last 90 days':'Paid order value in selected period'} legend={market?.currency||'Paid orders'}
  description="Currently paid orders, grouped by order creation date. GBP and NGN stay separate. Refunded orders are excluded. This is paid order value, not net revenue or profit."
  tableLabel="View sales figures" controls={market&&<label className={s.market}>Market<select aria-label="Sales chart market and currency" value={market.key} onChange={event=>setChoice(event.target.value)}>{markets.map(m=><option key={m.key} value={m.key}>{m.code==='GB'?'United Kingdom':m.code==='NG'?'Nigeria':m.code} · {m.currency}</option>)}</select></label>}/>;
}
