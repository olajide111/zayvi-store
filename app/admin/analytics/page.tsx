"use client";

import Link from "next/link";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

import { useEffect, useState } from "react";

type MarketMetric = {
  marketCode: string;
  currency: string;
  orderCount: number;
  paidOrders: number;
  paidValue: number;
  refundedOrderValue: number;
};

type RecentOrder = {
  id: string;
  orderNumber: string;
  marketCode: string;
  currency: string;
  total: number;
  paymentStatus: string;
  fulfilmentStatus: string;
  createdAt: string;
};

type AnalyticsResponse = {
  source: string;
  generatedAt: string;
  orders: {
    total: number;
    paid: number;
    pending: number;
    failed: number;
    partiallyRefunded: number;
    refunded: number;
  };
  markets: MarketMetric[];
  recentOrders: RecentOrder[];
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marketFilter, setMarketFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/analytics", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Unable to load analytics.");
        return payload;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <AdminPageHeading section="Insights" title="Commerce analytics" description="Review orders and payments recorded across your Preview markets.">
        <Link href="/admin/orders" prefetch={false} className={adminAction}>Orders</Link>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading analytics...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && data && (
          <>
            <h2 className="text-sm font-semibold text-[#215241]">Order status across all markets</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ["Orders", data.orders.total],
                ["Paid", data.orders.paid],
                ["Pending", data.orders.pending],
                ["Failed", data.orders.failed],
                ["Partial refunds", data.orders.partiallyRefunded],
                ["Refunded", data.orders.refunded],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-xs text-gray-400">{label}</div>
                  <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Market activity</h2>
              <select aria-label="Analytics market" value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className="min-h-11 rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm">
                <option value="all">All markets</option>
                <option value="GB">United Kingdom</option>
                <option value="NG">Nigeria</option>
              </select>
            </div>
            <div className="mt-3 grid gap-4 xl:grid-cols-2">
              {data.markets.filter((market) => marketFilter === "all" || market.marketCode === marketFilter).map((market) => (
                <div key={market.marketCode + ":" + market.currency} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Market</div>
                      <div className="mt-1 text-xl font-semibold">{market.marketCode === "NG" ? "Nigeria" : "United Kingdom"}</div>
                    </div>
                    <div className="rounded-xl bg-[#edf4ed] px-3 py-2 text-xs font-semibold text-[#31543b]">
                      {market.currency}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4">
                    <div className="rounded-xl bg-[#fafbf9] p-2.5 sm:p-4">
                      <div className="text-xs text-gray-400">Orders</div>
                      <div className="mt-1 text-2xl font-semibold">{market.orderCount}</div>
                    </div>
                    <div className="rounded-xl bg-[#fafbf9] p-2.5 sm:p-4">
                      <div className="text-xs text-gray-400">Paid orders</div>
                      <div className="mt-1 text-2xl font-semibold">{market.paidOrders}</div>
                    </div>
                    <div className="rounded-xl bg-[#fafbf9] p-2.5 sm:p-4">
                      <div className="text-xs text-gray-400">Paid value</div>
                      <div className="mt-1 text-base font-semibold break-words tabular-nums sm:text-lg">{money(market.paidValue, market.currency)}</div>
                    </div>
                    <div className="rounded-xl bg-[#fafbf9] p-2.5 sm:p-4">
                      <div className="text-xs text-gray-400">Refunded-order value</div>
                      <div className="mt-1 text-base font-semibold break-words tabular-nums sm:text-lg">{money(market.refundedOrderValue, market.currency)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {data.markets.every((market) => marketFilter !== "all" && market.marketCode !== marketFilter) && (
              <p className="rounded-xl border border-[#dfe6e1] bg-white p-4 text-sm text-[#52635b]">No order totals recorded for this view.</p>
            )}

            <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe6e1] bg-white" aria-label="Recent orders">
              <h2 className="border-b border-[#dfe6e1] px-4 py-3.5 font-semibold">Recent orders</h2>
              {data.recentOrders.every((order) => marketFilter !== "all" && order.marketCode !== marketFilter) && (
                <p className="p-4 text-sm text-[#52635b]">No recent orders in this view.</p>
              )}
              <ul className="divide-y divide-[#e4eae5]">
                {data.recentOrders.filter((order) => marketFilter === "all" || order.marketCode === marketFilter).map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${encodeURIComponent(order.id)}`} prefetch={false} className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-[#f5f8f5]">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold break-words text-[#215241]">{order.orderNumber}</p>
                        <p className="mt-0.5 text-xs capitalize text-[#52635b]">{order.marketCode} · {order.paymentStatus.replaceAll("_", " ")} · {order.fulfilmentStatus.replaceAll("_", " ")}</p>
                      </div>
                      <p className="min-w-0 text-right text-sm font-semibold break-words tabular-nums">{money(order.total, order.currency)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-4 text-right text-[11px] text-gray-400">
              Generated {new Date(data.generatedAt).toLocaleString("en-GB")}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
