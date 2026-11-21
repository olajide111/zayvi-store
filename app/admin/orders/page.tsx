"use client";

import Link from "next/link";
import {orderQueue,orderNextAction,type OrderQueue} from "@/lib/order-work-queue";
import { ArrowUpRight, Package, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  currency: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  orderStatus?: string;
  createdAt: string;
};

type OrdersResponse = {
  source: string;
  total: number;
  orders: Order[];
  purchasingEnabled: boolean;
  message?: string;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", { style: "currency", currency }).format(value);
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function StatusPill({ value, category }: { value: string; category: string }) {
  const normalized = value.toLowerCase();
  const positive = ["paid", "fulfilled", "completed"].includes(normalized);
  const pending = ["pending", "processing", "unfulfilled"].includes(normalized);

  const className = positive
    ? "bg-emerald-50 text-emerald-700"
    : pending
      ? "bg-amber-50 text-amber-700"
      : "bg-gray-100 text-gray-600";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {category}: {label(value)}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [queue,setQueue]=useState<OrderQueue>("all");
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("all");
  const [fulfilment, setFulfilment] = useState("all");
  const [orderState, setOrderState] = useState("all");
  const [revision, setRevision] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [currency, setCurrency] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function refresh() {
    setLoading(true);
    setError("");
    setRevision((current) => current + 1);
  }

  function clearFilters() {
    setQueue("all");
    setQuery("");
    setPayment("all");
    setFulfilment("all");
    setOrderState("all");
    setCurrency("all");
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    async function loadOrders() {
      try {
        const response = await fetch("/api/admin/orders", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          window.location.href = "/admin";
          return;
        }

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load orders.");
        }

        if (!Array.isArray(payload?.orders)) throw new Error("The orders response could not be read.");
        if (active) {
          setData(payload);
          setRefreshedAt(new Date().toISOString());
        }
      } catch (err) {
        if (active) setError(controller.signal.aborted ? "Orders took too long to load. Try refreshing." : err instanceof Error ? err.message : "Unable to load orders.");
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }

    void loadOrders();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [revision]);

  const orders = useMemo(() => data?.orders ?? [], [data]);
  const currencies = [...new Set(orders.map((order) => order.currency))].sort();
  const currencyOrders = orders.filter((order) => currency === "all" || order.currency === currency);
  const normalized = query.trim().toLowerCase();
  const visibleOrders = currencyOrders.filter((order) => {
    const matchesSearch = !normalized || [order.orderNumber, order.customerName, order.customerEmail]
      .some((value) => value?.toLowerCase().includes(normalized));
    return (queue === "all" || orderQueue(order) === queue) && matchesSearch && (payment === "all" || order.paymentStatus === payment) &&
      (fulfilment === "all" || order.fulfilmentStatus === fulfilment) &&
      (orderState === "all" || order.orderStatus === orderState);
  });
  const hasFilters = Boolean(queue !== "all" || normalized || payment !== "all" || fulfilment !== "all" || orderState !== "all" || currency !== "all");
  const paid = currencyOrders.filter((order) => order.paymentStatus === "paid").length;
  const unfulfilled = currencyOrders.filter((order) => order.fulfilmentStatus === "unfulfilled").length;
  const totals = new Map<string, number>();
  for (const order of currencyOrders) {
    totals.set(order.currency, (totals.get(order.currency) ?? 0) + Number(order.total));
  }

  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Workspace" title="Orders" description="Track payment and fulfilment for Preview orders.">
        <button type="button" onClick={refresh} disabled={loading} className={adminAction}><RefreshCw size={15} className="mr-2" aria-hidden="true" />{loading ? "Refreshing…" : "Refresh orders"}</button>
        <Link href="/admin/payments" prefetch={false} className={adminAction}>Payments</Link>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-7 lg:px-8">
        <p className="text-xs text-[#52635b]">Summary for {currency === "all" ? "all currencies" : currency}, before search and status filters. Search and totals cover loaded orders only.
          {refreshedAt && !loading && !error && <> Last refreshed <time dateTime={refreshedAt}>{new Date(refreshedAt).toLocaleTimeString("en-GB", { timeZone: "Europe/London" })}</time> (London time).</>}
        </p>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Loaded orders", value: currencyOrders.length },
            { label: "Paid", value: paid },
            { label: "Unfulfilled", value: unfulfilled },
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0 rounded-xl border border-[#dfe6e1] bg-white p-3 sm:p-4">
              <p className="text-xs font-medium text-[#52635b]">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{data && !loading && !error ? value : "—"}</p>
            </div>
          ))}
          <div className="min-w-0 rounded-xl border border-[#dfe6e1] bg-white p-3 sm:p-4">
            <p className="text-xs font-medium text-[#52635b]">Order value · all payment statuses</p>
            {totals.size && !loading && !error ? (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {[...totals].sort(([a], [b]) => a.localeCompare(b)).map(([code, amount]) => (
                  <div key={code} className="min-w-0">
                    <dt className="text-[11px] font-semibold text-[#52635b]">{code}</dt>
                    <dd className="font-semibold break-words tabular-nums">{money(amount, code)}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="mt-2 text-xl font-semibold">—</p>}
          </div>
        </div>

        <nav aria-label="Order work queues" className="flex flex-wrap gap-2">{([{id:'all',label:'All orders'},{id:'review',label:'Paid · review fulfilment'},{id:'payment',label:'Payment needs review'},{id:'closed',label:'Refunded / closed'}] as const).map(item=><button key={item.id} type="button" disabled={loading} aria-pressed={queue===item.id} onClick={()=>setQueue(item.id)} className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${queue===item.id?'bg-[#215241] text-white':'bg-white text-[#215241]'}`}>{item.label} <span className="ml-2">{loading||error?'—':currencyOrders.filter(o=>item.id==='all'||orderQueue(o)===item.id).length}</span></button>)}</nav>
        <p className="text-sm text-[#52635b]">Actions open the order for review. Paid Preview orders remain blocked from real dispatch. <Link href="/admin/automation" className="font-semibold underline">How fulfilment works</Link></p>
        <fieldset disabled={loading} className="grid gap-3 rounded-xl border border-[#dfe6e1] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
          <legend className="sr-only">Filter orders</legend>
          <label className="text-xs font-semibold text-[#52635b] sm:col-span-2 xl:col-span-4">Search orders
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order number, customer or email"
              className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-[#dfe6e1] px-3 text-sm font-normal text-[#172a21]" />
          </label>
          {[
            {title: "Payment status", value: payment, set: setPayment, options: ["unpaid", "pending", "paid", "failed", "partially_refunded", "refunded"]},
            {title: "Fulfilment status", value: fulfilment, set: setFulfilment, options: ["unfulfilled", "processing", "fulfilled", "cancelled"]},
            {title: "Order status", value: orderState, set: setOrderState, options: ["draft", "pending_payment", "confirmed", "cancelled", "completed"]},
            {title: "Currency", value: currency, set: setCurrency, options: currencies},
          ].map(({title, value, set, options}) => (
            <label key={title} className="min-w-0 text-xs font-semibold text-[#52635b]">{title}
              <select aria-label={title} value={value} onChange={(event) => set(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm font-normal text-[#172a21]">
                <option value="all">All {title === "Currency" ? "currencies" : "statuses"}</option>
                {options.map((option) => <option key={option} value={option}>{label(option)}</option>)}
              </select>
            </label>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 xl:col-span-4">
            <p role="status" className="text-sm text-[#52635b]">{loading || error ? "Order count unavailable" : `${visibleOrders.length} of ${orders.length} loaded orders`}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="min-h-11 px-2 text-sm font-semibold text-[#215241] underline">Clear filters</button>}
          </div>
        </fieldset>

        {loading && <p role="status" className="py-8 text-center text-sm text-[#52635b]">Loading orders…</p>}
        {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button type="button" onClick={refresh} className="mt-2 min-h-11 font-semibold underline">Retry loading orders</button></div>}
        {!loading && !error && (visibleOrders.length ? (
          <ul className="divide-y divide-[#e4eae5] rounded-xl border border-[#dfe6e1] bg-white" aria-label="Orders">
            {visibleOrders.map((order) => (
              <li key={order.id} className="min-w-0">
                <article className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_minmax(160px,1fr)] xl:items-center">
                  <div className="min-w-0"><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="font-semibold text-[#215241] underline">{order.orderNumber}</Link><p className="mt-1 truncate text-sm text-[#52635b]">{order.customerName||order.customerEmail||'Guest'}</p><p className="mt-1 text-xs text-[#52635b]">{order.orderStatus?label(order.orderStatus):'Order'} · {new Date(order.createdAt).toLocaleDateString('en-GB')}</p></div>
                  <div><p className="mb-1 text-xs font-semibold text-[#52635b]">Payment</p><StatusPill value={order.paymentStatus} category="Payment"/></div>
                  <div><p className="mb-1 text-xs font-semibold text-[#52635b]">Fulfilment</p><StatusPill value={order.fulfilmentStatus} category="Fulfilment"/></div>
                  <p className="text-base font-semibold tabular-nums">{money(order.total,order.currency)}</p>
                  <div><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} prefetch={false} aria-label={`${orderNextAction(order).title} for ${order.orderNumber}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#215241] px-4 text-sm font-semibold text-white">{orderNextAction(order).title}<ArrowUpRight size={15}/></Link><p className="mt-2 text-xs leading-5 text-[#52635b]">{orderNextAction(order).detail}</p></div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-[#dfe6e1] bg-white px-5 py-8 text-center">
            <Package size={27} className="mx-auto text-[#215241]" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">{orders.length ? "No matching orders" : "No orders yet"}</h2>
            <p className="mt-1 text-sm text-[#52635b]">{orders.length ? "Try another search or clear the filters." : data?.message || "Orders will appear here once they are placed."}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="mt-3 min-h-11 px-3 text-sm font-semibold text-[#215241] underline">Clear filters</button>}
          </div>
        ))}
      </section>
    </main>
  );
}
