"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Download,RefreshCw,ArrowRight} from 'lucide-react';
import AdminPageHeading,{adminAction} from './AdminPageHeading';
import CampaignLinkBuilder from './CampaignLinkBuilder';
import {analyticsCsv,dailyOrderSeries,growthActions,percentageChange,type AnalyticsReport} from '@/lib/analytics-report';

const panel='min-w-0 rounded-2xl border border-[#dfe6e1] bg-white p-5';
const money=(value:number,currency:string)=>new Intl.NumberFormat(currency==='NGN'?'en-NG':'en-GB',{style:'currency',currency}).format(value);
const marketName=(code:string)=>code==='NG'?'Nigeria':code==='GB'?'United Kingdom':code;
type LegacyReport={orders:{total:number;paid:number;refunded:number};markets:{marketCode:string;currency:string;paidValue:number;orderCount:number}[]};
function change(current:number,previous:number|undefined){
  if(previous===undefined)return 'No comparison selected';
  const value=percentageChange(current,previous);
  return value===null?(current?'New activity; previous period was zero':'No change from zero'):`${value>0?'+':''}${value.toFixed(1)}% vs previous period`;
}
function OrderTrend({data}:{data:AnalyticsReport}){
  const points=dailyOrderSeries(data),max=Math.max(1,...points.map(p=>p.orders)),width=640,height=140,barWidth=width/Math.max(points.length,1);
  return <section className={panel} aria-labelledby="trend-title">
    <div className="flex flex-wrap justify-between gap-2"><h2 id="trend-title" className="font-semibold">Orders over time</h2><span className="text-xs text-[#64756b]">Daily · UTC{data.filters.range==='all'?' · last 90 days':''}</span></div>
    <p className="mt-1 text-sm text-[#64756b]">Order counts across selected markets. No currencies are combined.</p>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily order counts, ${points.reduce((n,p)=>n+p.orders,0)} orders in the chart`} className="mt-5 h-36 w-full">
      <line x1="0" y1={height-1} x2={width} y2={height-1} stroke="#dfe6e1"/>
      {points.map((p,i)=><rect key={p.day} x={i*barWidth+1} y={height-p.orders/max*(height-5)} width={Math.max(1,barWidth-2)} height={p.orders/max*(height-5)} rx="2" fill="#215241"><title>{p.day}: {p.orders} orders</title></rect>)}
    </svg>
    <div className="mt-1 flex justify-between text-xs text-[#64756b]"><span>{points[0]?.day}</span><span>{points.at(-1)?.day}</span></div>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-[#215241]">View daily figures</summary><div className="mt-3 max-h-60 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Date (UTC)</th><th className="text-right">Orders</th></tr></thead><tbody>{points.map(p=><tr key={p.day} className="border-t border-[#e8ede8]"><td className="py-2">{p.day}</td><td className="text-right tabular-nums">{p.orders}</td></tr>)}</tbody></table></div></details>
  </section>;
}
export default function CommerceAnalyticsWorkspace({growth=false}:{growth?:boolean}){
  const [range,setRange]=useState('30d'),[market,setMarket]=useState('all'),[revision,setRevision]=useState(0);
  const [result,setResult]=useState<{key:string;data?:AnalyticsReport;legacy?:LegacyReport;error?:string}|null>(null);
  const key=`${range}:${market}:${revision}`;
  useEffect(()=>{
    const controller=new AbortController();let active=true;const timer=window.setTimeout(()=>controller.abort(),15000);
    async function load(){try{
      const response=await fetch(`/api/admin/analytics?${new URLSearchParams({range,market})}`,{cache:'no-store',credentials:'include',signal:controller.signal});
      if(response.status===401){window.location.replace('/admin');return;}
      if(!response.ok)throw new Error('Analytics could not load. Please retry.');
      const data=await response.json();
      if(data.schemaVersion!==2){
        if(data.source==='postgresql'&&data.orders&&Array.isArray(data.markets)){if(active)setResult({key,legacy:data});return;}
        throw new Error('The analytics response is unavailable. Please retry.');
      }
      if(data.filters?.range!==range||data.filters?.market!==market)throw new Error('The server could not confirm the selected report filters. Please retry.');
      if(active)setResult({key,data});
    }catch(error){if(active)setResult({key,error:error instanceof Error?error.message:'Analytics could not load.'});}finally{window.clearTimeout(timer);}}
    void load();return()=>{active=false;window.clearTimeout(timer);controller.abort();};
  },[key,range,market]);
  const state=result?.key===key?result:null,data=state?.data,actions=data?growthActions(data):[];
  function download(){if(!data)return;const url=URL.createObjectURL(new Blob([analyticsCsv(data)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`zayvi-${market}-${range}-${data.period.to.slice(0,10)}.csv`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
    <AdminPageHeading section={growth?'Growth':'Insights'} title={growth?'Marketing & sales growth':'Sales analytics'} description={growth?'Find the next useful action from recorded commerce activity.':'Understand order activity by period and market.'}>
      <Link href={growth?'/admin/analytics':'/admin/growth'} className={adminAction}>{growth?'Sales analytics':'Sales growth'}<ArrowRight size={15}/></Link>
    </AdminPageHeading>
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 py-5 sm:px-7">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#dfe6e1] bg-white p-4">
        <label className="text-xs font-medium text-[#52635b]">Period<select disabled={!!state?.legacy} value={state?.legacy?'all':range} onChange={e=>setRange(e.target.value)} className="mt-1 block min-h-11 rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm text-[#202923]"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></select></label>
        <label className="text-xs font-medium text-[#52635b]">Market<select disabled={!!state?.legacy} value={state?.legacy?'all':market} onChange={e=>setMarket(e.target.value)} className="mt-1 block min-h-11 rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm text-[#202923]"><option value="all">All markets</option><option value="NG">Nigeria · NGN</option><option value="GB">United Kingdom · GBP</option></select></label>
        <button onClick={()=>setRevision(n=>n+1)} className={adminAction}><RefreshCw size={15}/>Refresh</button>
        <button disabled={!data} onClick={download} className={`${adminAction} disabled:opacity-40`}><Download size={15}/>Export CSV</button>
      </div>
      <p className="text-xs leading-relaxed text-[#64756b]">Existing commerce workspace · Preview order data. Hammy’s sample storefront is not connected to these figures.</p>
      {growth&&<CampaignLinkBuilder/>}
      {!state&&<p role="status" className={panel}>Loading your report…</p>}
      {state?.legacy&&<section className={panel} aria-label="Existing all-time report">
        <p className="text-sm text-[#64756b]">All-time report. Date comparisons and growth analysis will become available after the analytics API update is deployed to AWS.</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3"><div><dt className="text-xs text-[#64756b]">Orders</dt><dd className="mt-1 text-2xl font-semibold">{state.legacy.orders.total}</dd></div><div><dt className="text-xs text-[#64756b]">Currently paid</dt><dd className="mt-1 text-2xl font-semibold">{state.legacy.orders.paid}</dd></div><div><dt className="text-xs text-[#64756b]">Refunded orders</dt><dd className="mt-1 text-2xl font-semibold">{state.legacy.orders.refunded}</dd></div></dl>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{state.legacy.markets.map(m=><article key={`${m.marketCode}:${m.currency}`} className="rounded-xl bg-[#f5f8f5] p-4"><h2 className="font-semibold">{marketName(m.marketCode)} · {m.currency}</h2><p className="mt-2 text-xs text-[#64756b]">Currently paid order value</p><p className="mt-1 text-xl font-semibold">{money(m.paidValue,m.currency)}</p></article>)}</div>
        <Link href="/admin/orders" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#215241]">Review orders<ArrowRight size={15}/></Link>
      </section>}
      {state?.error&&<div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><p>{state.error}</p><button onClick={()=>setRevision(n=>n+1)} className="mt-3 min-h-11 underline">Try again</button></div>}
      {data&&<>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Order metrics">
          {[
            {title:'Orders',value:data.orders.total,previous:data.previous?.orders.total},
            {title:'Currently paid',value:data.orders.paid,previous:data.previous?.orders.paid},
            {title:'Unpaid / pending',value:data.orders.unpaid+data.orders.pending,previous:data.previous?data.previous.orders.unpaid+data.previous.orders.pending:undefined},
            {title:'Refunded orders',value:data.orders.refunded+data.orders.partiallyRefunded,previous:data.previous?data.previous.orders.refunded+data.previous.orders.partiallyRefunded:undefined},
          ].map(item=><div key={item.title} className={panel}><h2 className="text-xs text-[#64756b]">{item.title}</h2><p className="mt-2 text-3xl font-semibold tabular-nums">{item.value}</p><p className="mt-2 text-xs leading-relaxed text-[#64756b]">{change(item.value,item.previous)}</p></div>)}
        </section>
        {growth?<>
          <section aria-labelledby="growth-actions"><h2 id="growth-actions" className="mb-3 text-lg font-semibold">Where to focus</h2><div className="grid gap-3 md:grid-cols-2">{actions.map(item=><article key={item.key} className={panel}><p className="text-2xl font-semibold tabular-nums">{item.count}</p><h3 className="mt-2 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-[#64756b]">{item.detail}</p><Link href={item.href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#215241]">{item.action}<ArrowRight size={15}/></Link></article>)}</div>{!actions.length&&<p className={panel}>No payment, fulfilment or refund follow-up surfaced in this period. Review your catalogue and market availability next.</p>}</section>
          <section className={panel}><h2 className="font-semibold">Build demand with a reliable store</h2><div className="mt-4 grid gap-4 sm:grid-cols-3">{[
            ['Market availability','Check prices, listings and delivery coverage.','/admin/markets'],
            ['Product discovery','Review supplier evidence and product suitability.','/admin/discovery'],
            ['Store content','Publish useful guidance and customer-care pages.','/admin/content'],
          ].map(([title,detail,href])=><Link key={href} href={href} className="rounded-xl bg-[#f5f8f5] p-4"><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm text-[#64756b]">{detail}</p><ArrowRight className="mt-3" size={16}/></Link>)}</div></section>
          <section className={panel}><h2 className="font-semibold">Measurement still to connect</h2><p className="mt-2 text-sm leading-relaxed text-[#64756b]">Visitor conversion, abandoned carts, campaign return and customer acquisition cost are not measured yet. Recovery messages, bundles and campaigns are not enabled by this page.</p><Link href="/admin/pilots/hammy/integrations" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#215241]">View Hammy integration readiness<ArrowRight className="ml-2" size={15}/></Link></section>
        </>:<OrderTrend data={data}/>}
        <section aria-labelledby="market-metrics"><h2 id="market-metrics" className="mb-3 text-lg font-semibold">Market performance</h2><div className="grid gap-4 md:grid-cols-2">{data.markets.map(item=>{
          const previous=data.previous?.markets.find(m=>m.marketCode===item.marketCode&&m.currency===item.currency);
          return <article key={`${item.marketCode}:${item.currency}`} className={panel}><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{marketName(item.marketCode)}</h3><span className="rounded-lg bg-[#edf4ed] px-3 py-1 text-xs font-medium">{item.currency}</span></div><p className="mt-4 text-xs text-[#64756b]">Currently paid order value</p><p className="mt-1 break-words text-3xl font-semibold tabular-nums">{money(item.paidValue,item.currency)}</p><p className="mt-2 text-xs text-[#64756b]">{change(item.paidValue,data.previous?previous?.paidValue||0:undefined)}</p><dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#e8ede8] pt-4"><div><dt className="text-xs text-[#64756b]">Orders</dt><dd className="mt-1 font-semibold">{item.orderCount}</dd></div><div><dt className="text-xs text-[#64756b]">Average paid order</dt><dd className="mt-1 break-words font-semibold">{item.paidAverageOrderValue===null?'—':money(item.paidAverageOrderValue,item.currency)}</dd></div></dl></article>;
        })}</div>{!data.markets.length&&<p className={panel}>No orders recorded for this period and market.</p>}</section>
        {!growth&&<section className={`${panel} overflow-hidden`}><h2 className="font-semibold">Recent orders</h2><ul className="mt-3 divide-y divide-[#e8ede8]">{data.recentOrders.map(order=><li key={order.id}><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="flex min-h-16 items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold text-[#215241]">{order.orderNumber}</p><p className="mt-1 text-xs capitalize text-[#64756b]">{marketName(order.marketCode)} · {order.paymentStatus.replaceAll('_',' ')}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{money(order.total,order.currency)}</span></Link></li>)}</ul>{!data.recentOrders.length&&<p className="mt-3 text-sm text-[#64756b]">No recent orders in this view.</p>}</section>}
        <details className="rounded-xl border border-[#dfe6e1] p-4 text-xs leading-relaxed text-[#64756b]"><summary className="cursor-pointer font-medium">How these figures are calculated</summary><p className="mt-3">{data.measurement.basis} {data.measurement.paidValue} {data.measurement.refunds} These figures are not net revenue, profit or payment-date reporting.</p><p className="mt-2">{data.period.from?`${data.period.from} to `:'All records before '}{data.period.to} · UTC. Current statuses can change after refunds or reconciliation.</p></details>
      </>}
    </div>
  </main>;
}
