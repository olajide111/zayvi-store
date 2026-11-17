"use client";

import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
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

function StatusPill({ value }: { value: string }) {
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
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await fetch("/api/admin/orders", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.href = "/admin";
          return;
        }

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load orders.");
        }

        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load orders.");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  const orders = useMemo(() => data?.orders ?? [], [data]);
  const currencies = [...new Set(orders.map((order) => order.currency))].sort();
  const currencyOrders = orders.filter((order) => currency === "all" || order.currency === currency);
  const normalized = query.trim().toLowerCase();
  const visibleOrders = currencyOrders.filter((order) => {
    const matchesSearch = !normalized || [order.orderNumber, order.customerName, order.customerEmail]
      .some((value) => value?.toLowerCase().includes(normalized));
    const matchesStatus = status === "all" || [
      order.paymentStatus, order.fulfilmentStatus, order.orderStatus,
    ].includes(status);
    return matchesSearch && matchesStatus;
  });
  const paid = currencyOrders.filter((order) => order.paymentStatus === "paid").length;
  const unfulfilled = currencyOrders.filter((order) => order.fulfilmentStatus === "unfulfilled").length;
  const totals = new Map<string, number>();
  for (const order of currencyOrders) {
    totals.set(order.currency, (totals.get(order.currency) ?? 0) + Number(order.total));
  }

  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Workspace" title="Orders" description="Track payment and fulfilment for Preview orders.">
        <Link href="/admin/payments" prefetch={false} className={adminAction}>Payments</Link>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-7 lg:px-8">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Loaded orders", value: currencyOrders.length },
            { label: "Paid", value: paid },
            { label: "Unfulfilled", value: unfulfilled },
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0 rounded-xl border border-[#dfe6e1] bg-white p-3 sm:p-4">
              <p className="text-xs font-medium text-[#52635b]">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{data ? value : "—"}</p>
            </div>
          ))}
          <div className="min-w-0 rounded-xl border border-[#dfe6e1] bg-white p-3 sm:p-4">
            <p className="text-xs font-medium text-[#52635b]">Order value · all payment statuses</p>
            {totals.size ? (
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

        <div className="grid gap-2 rounded-xl border border-[#dfe6e1] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            aria-label="Search orders"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order, customer or email"
            className="min-h-11 min-w-0 rounded-lg border border-[#dfe6e1] px-3 text-sm"
          />
          <select aria-label="Payment or fulfilment status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending payment</option>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="min-h-11 rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm">
            <option value="all">All currencies</option>
            {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>

        {loading && <p role="status" className="py-8 text-center text-sm text-[#52635b]">Loading orders…</p>}
        {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!loading && !error && (visibleOrders.length ? (
          <ul className="divide-y divide-[#e4eae5] rounded-xl border border-[#dfe6e1] bg-white" aria-label="Orders">
            {visibleOrders.map((order) => (
              <li key={order.id} className="min-w-0">
                <Link href={`/admin/orders/${encodeURIComponent(order.id)}`} prefetch={false} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.5fr)] items-start gap-x-3 gap-y-2 rounded-lg px-3 py-3.5 hover:bg-[#f5f8f5] sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold break-words text-[#215241]">{order.orderNumber}</p>
                    <p className="mt-0.5 truncate text-xs text-[#52635b]">{order.customerName || order.customerEmail || "Guest"}</p>
                  </div>
                  <div className="col-start-2 row-start-1 text-right xl:col-start-3">
                    <p className="flex items-start justify-end gap-1.5 text-sm font-semibold break-words tabular-nums">
                      <span className="min-w-0">{money(order.total, order.currency)}</span>
                      <ArrowUpRight size={15} className="shrink-0 text-[#52635b]" aria-hidden="true" />
                    </p>
                    <time dateTime={order.createdAt} className="text-xs text-[#52635b]">
                      {new Date(order.createdAt).toLocaleDateString("en-GB")}
                    </time>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-1.5 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:pt-1">
                    <StatusPill value={order.paymentStatus} />
                    <StatusPill value={order.fulfilmentStatus} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-[#dfe6e1] bg-white px-5 py-8 text-center">
            <Package size={27} className="mx-auto text-[#215241]" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">{orders.length ? "No matching orders" : "No orders yet"}</h2>
            <p className="mt-1 text-sm text-[#52635b]">{orders.length ? "Try another search or clear the filters." : data?.message || "Orders will appear here once they are placed."}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
