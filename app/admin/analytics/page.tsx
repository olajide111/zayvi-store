"use client";

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
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(Number(value || 0));
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Analytics</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Commerce analytics</h1>
          </div>
          <a href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">
            Back to overview
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">Operational analytics from PostgreSQL</div>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            These metrics come from stored Zayvi orders and payment states. No forecasted or AI-generated sales figures are included.
          </p>
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading analytics...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && data && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
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
                  <div className="mt-2 text-3xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {data.markets.map((market) => (
                <div key={market.marketCode} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Market</div>
                      <div className="mt-1 text-xl font-semibold">{market.marketCode === "NG" ? "Nigeria" : "United Kingdom"}</div>
                    </div>
                    <div className="rounded-xl bg-[#edf4ed] px-3 py-2 text-xs font-semibold text-[#31543b]">
                      {market.currency}
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[#fafbf9] p-4">
                      <div className="text-xs text-gray-400">Orders</div>
                      <div className="mt-1 text-2xl font-semibold">{market.orderCount}</div>
                    </div>
                    <div className="rounded-xl bg-[#fafbf9] p-4">
                      <div className="text-xs text-gray-400">Paid orders</div>
                      <div className="mt-1 text-2xl font-semibold">{market.paidOrders}</div>
                    </div>
                    <div className="rounded-xl bg-[#fafbf9] p-4">
                      <div className="text-xs text-gray-400">Paid value</div>
                      <div className="mt-1 text-lg font-semibold">{money(market.paidValue, market.currency)}</div>
                    </div>
                    <div className="rounded-xl bg-[#fafbf9] p-4">
                      <div className="text-xs text-gray-400">Refunded-order value</div>
                      <div className="mt-1 text-lg font-semibold">{money(market.refundedOrderValue, market.currency)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="text-sm font-semibold">Recent orders</div>
                <div className="mt-1 text-xs text-gray-400">Latest stored order activity across enabled markets</div>
              </div>
              <div className="divide-y divide-gray-100">
                {data.recentOrders.map((order) => (
                  <a key={order.id} href={`/admin/orders/${order.id}`} className="grid grid-cols-[1fr_100px] gap-4 px-5 py-4 hover:bg-gray-50 md:grid-cols-[160px_100px_120px_140px_1fr]">
                    <div className="text-sm font-semibold text-[#23432d]">{order.orderNumber}</div>
                    <div className="text-xs text-gray-500">{order.marketCode}</div>
                    <div className="hidden text-xs capitalize text-gray-500 md:block">{order.paymentStatus.replaceAll("_", " ")}</div>
                    <div className="hidden text-xs capitalize text-gray-500 md:block">{order.fulfilmentStatus.replaceAll("_", " ")}</div>
                    <div className="text-right text-sm font-semibold">{money(order.total, order.currency)}</div>
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-4 text-right text-[11px] text-gray-400">
              Generated {new Date(data.generatedAt).toLocaleString("en-GB")}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
