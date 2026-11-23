"use client";
import Link from 'next/link';
import {Copy,RefreshCw,Users,ChevronDown} from 'lucide-react';
import {useEffect,useState} from 'react';
import AdminPageHeading,{adminAction} from '@/components/admin/AdminPageHeading';
import {useAdminOrderSearch} from '@/components/admin/AdminOrderSearch';
import {customerDate,customerSegment,selectCustomers,type CustomerRecord,type CustomerSegment,type CustomerSort} from '@/lib/customer-workspace';
type ResponseData={total:number;customers:CustomerRecord[];message?:string};
export default function AdminCustomersPage(){
  const orderSearch=useAdminOrderSearch();
  const [revision,setRevision]=useState(0),[query,setQuery]=useState(''),[segment,setSegment]=useState<CustomerSegment>('all');
  const [status,setStatus]=useState('all'),[sort,setSort]=useState<CustomerSort>('recent'),[notice,setNotice]=useState('');
  const [limit,setLimit]=useState(25);
  const [result,setResult]=useState<{revision:number;data?:ResponseData;error?:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();let active=true;const timer=window.setTimeout(()=>controller.abort(),15000);
    async function load(){try{
      const response=await fetch('/api/admin/customers',{credentials:'include',cache:'no-store',signal:controller.signal});
      if(response.status===401){window.location.replace('/admin');return;}
      if(!response.ok)throw new Error('Customers could not load. Please retry.');
      const data=await response.json();if(!Array.isArray(data.customers))throw new Error('Customer records could not be read.');
      if(active)setResult({revision,data});
    }catch{if(active)setResult({revision,error:controller.signal.aborted?'Customer records took too long to load. Try again.':'Customers could not load. Please retry.'});}finally{window.clearTimeout(timer);}}
    void load();return()=>{active=false;window.clearTimeout(timer);controller.abort();};
  },[revision]);
  const state=result?.revision===revision?result:null,data=state?.data,customers=data?.customers||[];
  const visible=selectCustomers(customers,{query,segment,status,sort});
  useEffect(()=>setLimit(25),[query,segment,status,sort,revision]);
  const filtered=!!(query||segment!=='all'||status!=='all');
  async function copy(value:string){try{await navigator.clipboard.writeText(value);setNotice('Contact detail copied.');}catch{setNotice('Copy is unavailable. Select the contact detail and copy it manually.');}}
  function reset(){setQuery('');setSegment('all');setStatus('all');setSort('recent');}
  return <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
    <AdminPageHeading section="Operations" title="Customers" description="Find a customer, review their record and prepare your next action.">
      <button className={adminAction} onClick={()=>{setNotice('');setRevision(n=>n+1);}}><RefreshCw size={15}/>Refresh</button><Link href="/admin/orders" className={adminAction}>Orders</Link>
    </AdminPageHeading>
    <section className="mx-auto max-w-[1280px] space-y-4 px-4 py-5 sm:px-7">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[
        ['Loaded records',customers.length],['Multiple order records',customers.filter(c=>customerSegment(c)==='repeat').length],['No order records',customers.filter(c=>customerSegment(c)==='none').length],
      ].map(([label,value])=><div key={String(label)} className="rounded-xl border border-[#dfe6e1] bg-white p-4"><p className="text-xs text-[#64756b]">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{data?value:'—'}</p></div>)}</div>
      <div className="space-y-3 rounded-2xl border border-[#dfe6e1] bg-white p-4">
        <label className="block text-xs font-medium text-[#52635b]">Find a customer<input type="search" value={query} onChange={event=>setQuery(event.target.value)} maxLength={150} placeholder="Name, email or phone" className="mt-1 min-h-11 w-full rounded-lg border border-[#dfe6e1] px-3 text-sm"/></label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-[#52635b]">Order activity<select value={segment} onChange={event=>setSegment(event.target.value as CustomerSegment)} className="mt-1 min-h-11 w-full rounded-lg border border-[#dfe6e1] bg-white px-2 text-sm"><option value="all">All records</option><option value="repeat">Multiple orders</option><option value="single">One order</option><option value="none">No orders</option></select></label>
          <label className="text-xs font-medium text-[#52635b]">Record status<select value={status} onChange={event=>setStatus(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#dfe6e1] bg-white px-2 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option><option value="archived">Archived</option></select></label>
          <label className="col-span-2 text-xs font-medium text-[#52635b] sm:col-span-1">Sort<select value={sort} onChange={event=>setSort(event.target.value as CustomerSort)} className="mt-1 min-h-11 w-full rounded-lg border border-[#dfe6e1] bg-white px-2 text-sm"><option value="recent">Recent activity</option><option value="orders">Most order records</option><option value="name">Name</option></select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-[#64756b]">{data?`${visible.length} of ${customers.length} loaded records`:'Customer count unavailable'}</p>{filtered&&<button className="min-h-11 text-sm font-medium text-[#215241] underline" onClick={reset}>Clear filters</button>}</div>
      </div>
      {notice&&<p role="status" className="rounded-xl bg-[#edf4ed] p-3 text-sm text-[#215241]">{notice}</p>}
      {!state&&<p role="status" className="py-8 text-center text-sm text-[#64756b]">Loading customers…</p>}
      {state?.error&&<div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><p>{state.error}</p><button className="mt-2 min-h-11 underline" onClick={()=>setRevision(n=>n+1)}>Try again</button></div>}
      {data&&(visible.length?<ul aria-label="Customer records" className="space-y-3">{visible.slice(0,limit).map(customer=><li key={customer.id} className="rounded-2xl border border-[#dfe6e1] bg-white">
        <details className="group"><summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden"><div className="min-w-0"><h2 className="break-words text-sm font-semibold">{customer.name||'Customer'}</h2><p className="mt-1 text-xs text-[#64756b]">{customer.orderCount} order record{customer.orderCount===1?'':'s'} · <span className="capitalize">{customer.status}</span></p><p className="mt-1 text-xs text-[#64756b]">Last order: {customerDate(customer.lastOrderAt)}</p></div><ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[#52635b] transition-transform group-open:rotate-180"/></summary>
          <div className="space-y-4 border-t border-[#e8ede8] p-4"><dl className="grid gap-4 sm:grid-cols-2">
            {[['Email',customer.email],['Phone',customer.phone||'Not provided']].map(([label,value])=><div key={label}><dt className="text-xs text-[#64756b]">{label}</dt><dd className="mt-1 select-text break-all text-sm">{value}</dd>{(label==='Email'||customer.phone)&&<button type="button" className="mt-1 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#215241]" onClick={()=>copy(value)}><Copy size={14}/>Copy {label.toLowerCase()}</button>}</div>)}
            <div><dt className="text-xs text-[#64756b]">First order</dt><dd className="mt-1 text-sm">{customerDate(customer.firstOrderAt)}</dd></div><div><dt className="text-xs text-[#64756b]">Record created</dt><dd className="mt-1 text-sm">{customerDate(customer.createdAt)}</dd></div>
          </dl><p className="text-xs leading-relaxed text-[#64756b]">Find orders with this email in the records currently loaded in the order workspace.</p><Link href="/admin/orders" prefetch={false} onClick={event=>{if((event.button===0||event.detail===0)&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)orderSearch?.prepare(customer.email);}} className={adminAction}>Find matching orders</Link></div>
        </details>
      </li>)}</ul>:<div className="rounded-2xl border border-[#dfe6e1] bg-white p-7 text-center"><Users size={24} aria-hidden="true" className="mx-auto text-[#215241]"/><h2 className="mt-3 font-semibold">{customers.length?'No matching customers':'No customer records yet'}</h2><p className="mt-2 text-sm text-[#64756b]">{customers.length?'Try another search or clear the filters.':data.message||'Records appear when orders are created.'}</p>{filtered&&<button className="mt-3 min-h-11 text-sm font-medium text-[#215241] underline" onClick={reset}>Clear filters</button>}</div>)}
      {data&&visible.length>0&&<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#64756b]">Showing {Math.min(limit,visible.length)} of {visible.length} matching loaded records</p>{limit<visible.length&&<button className={adminAction} onClick={()=>setLimit(n=>n+25)}>Show 25 more</button>}</div>}
      <details className="rounded-xl border border-[#dfe6e1] p-4 text-xs leading-relaxed text-[#64756b]"><summary className="cursor-pointer font-medium">About these records</summary><p className="mt-2">The existing commerce workspace returns up to 250 customer records. Order counts can include draft and unpaid orders and exclude cancelled orders; they are not confirmed repeat purchases. Contact details do not establish marketing consent. Hammy’s sample basket does not create customer records.</p></details>
    </section>
  </main>;
}
