"use client";
import {useState} from 'react';
import {dailyPaidValueSeries,type AnalyticsReport} from '@/lib/analytics-report';
const money=(value:number,currency:string)=>new Intl.NumberFormat(currency==='NGN'?'en-NG':'en-GB',{style:'currency',currency}).format(value);
export default function SalesValueChart({data}:{data:AnalyticsReport}){
  const markets=data.markets.map(m=>({key:`${m.marketCode}:${m.currency}`,code:m.marketCode,currency:m.currency}));
  const [choice,setChoice]=useState(''),[selection,setSelection]=useState<number|null>(null);
  const market=markets.find(m=>m.key===choice)||markets[0];
  if(!market)return <section className="rounded-2xl border border-[#dfe6e1] bg-white p-5"><h2 className="font-semibold">Sales value over time</h2><p className="mt-2 text-sm text-[#64756b]">No recorded orders for this period and market yet.</p></section>;
  const points=dailyPaidValueSeries(data,market.code,market.currency),max=Math.max(1,...points.map(p=>p.value));
  const index=Math.min(selection??Math.max(0,points.length-1),Math.max(0,points.length-1)),selected=points[index];
  const width=640,height=180,bottom=height-10,plotHeight=height-25;
  const x=(i:number)=>(i+.5)*width/Math.max(1,points.length),y=(value:number)=>bottom-value/max*plotHeight;
  const line=points.map((p,i)=>`${x(i)},${y(p.value)}`).join(' '),total=points.reduce((sum,p)=>sum+p.value,0);
  return <section className="min-w-0 rounded-2xl border border-[#dfe6e1] bg-white p-5" aria-labelledby="sales-chart-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="sales-chart-title" className="font-semibold">Sales value over time</h2><p className="mt-1 text-sm text-[#64756b]">Currently paid orders · by order creation date · UTC</p></div>
      <label className="text-xs font-medium text-[#52635b]">Chart market<select aria-label="Sales chart market and currency" value={market.key} onChange={event=>{setChoice(event.target.value);setSelection(null);}} className="mt-1 block min-h-11 rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm">{markets.map(m=><option key={m.key} value={m.key}>{m.code==='GB'?'United Kingdom':m.code==='NG'?'Nigeria':m.code} · {m.currency}</option>)}</select></label>
    </div>
    <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-[#64756b]">Paid order value in this chart{data.filters.range==='all'?' · last 90 days':''}</p><p className="mt-1 break-words text-3xl font-semibold tabular-nums text-[#215241]">{money(total,market.currency)}</p></div><p className="text-xs text-[#64756b]">Peak day {money(Math.max(0,...points.map(p=>p.value)),market.currency)}</p></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily currently paid order value for ${market.code}, ${market.currency}. Use the day selector below for exact figures.`} className="mt-4 h-44 w-full touch-pan-y" onPointerDown={event=>{const bounds=event.currentTarget.getBoundingClientRect();if(bounds.width>0)setSelection(Math.max(0,Math.min(points.length-1,Math.floor((event.clientX-bounds.left)/bounds.width*points.length))));}}>
      {[0,.5,1].map(level=><line key={level} x1="0" x2={width} y1={y(max*level)} y2={y(max*level)} stroke="#e4eae5" strokeDasharray={level?'4 5':undefined}/>)}
      {points.length>0&&<><polygon points={`${x(0)},${bottom} ${line} ${x(points.length-1)},${bottom}`} fill="#edf4ed"/><polyline points={line} fill="none" stroke="#215241" strokeWidth="3" strokeLinejoin="round"/>
        {selected&&<><line x1={x(index)} x2={x(index)} y1="8" y2={bottom} stroke="#8a9f92" strokeDasharray="3 4"/><circle cx={x(index)} cy={y(selected.value)} r="5" fill="#215241" stroke="white" strokeWidth="2"/></>}</>}
    </svg>
    <div className="flex justify-between text-xs text-[#64756b]"><span>{points[0]?.day}</span><span>{points.at(-1)?.day}</span></div>
    {selected&&<div className="mt-4 rounded-xl bg-[#f5f8f5] p-3"><label className="flex flex-wrap justify-between gap-2 text-sm font-medium" htmlFor="sales-chart-day"><span>{selected.day} · UTC</span><output aria-live="polite" className="tabular-nums">{money(selected.value,market.currency)}</output></label><input id="sales-chart-day" aria-label="Select a day in the sales chart" aria-valuetext={`${selected.day}: ${money(selected.value,market.currency)}`} type="range" min="0" max={Math.max(0,points.length-1)} value={index} onChange={event=>setSelection(Number(event.target.value))} className="min-h-11 w-full accent-[#215241]"/></div>}
    <p className="mt-3 text-xs leading-relaxed text-[#64756b]">GBP and NGN stay separate. Refunded orders are excluded. This is paid order value, not net revenue or profit.</p>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-[#215241]">View sales figures</summary><div className="mt-3 max-h-60 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Date (UTC)</th><th className="text-right">Value ({market.currency})</th></tr></thead><tbody>{points.map(p=><tr key={p.day} className="border-t border-[#e8ede8]"><td className="py-2">{p.day}</td><td className="text-right tabular-nums">{money(p.value,market.currency)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
