"use client";

import { useEffect, useMemo, useState } from "react";

type ReturnRow = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  marketCode: string;
  currency: string;
  total: number;
  paymentStatus: string;
  fulfilmentStatus: string;
  source: string;
  provider?: string | null;
  providerReference?: string | null;
  paymentAttemptStatus?: string | null;
  refundedMinor: number;
  refundableMinor: number;
  refundState: "not_refunded" | "partially_refunded" | "refunded";
  refundEligible: boolean;
  paymentUpdatedAt?: string | null;
  createdAt: string;
};

type ReturnsResponse = {
  source: string;
  total: number;
  returns: ReturnRow[];
  actionsEnabled: boolean;
  message?: string;
};

function formatMoneyMinor(valueMinor: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(Number(valueMinor || 0) / 100);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(Number(value || 0));
}

function StatePill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const className =
    normalized === "refunded"
      ? "bg-gray-100 text-gray-700"
      : normalized === "partially_refunded"
        ? "bg-amber-50 text-amber-700"
        : normalized === "paid"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-blue-50 text-blue-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default function AdminReturnsPage() {
  const [data, setData] = useState<ReturnsResponse | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/returns", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load returns and refunds.");
        }

        return payload;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Unable to load returns and refunds."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (data?.returns ?? []).filter((row) => {
      const matchesQuery =
        !normalized ||
        row.orderNumber.toLowerCase().includes(normalized) ||
        row.customerName.toLowerCase().includes(normalized) ||
        row.customerEmail.toLowerCase().includes(normalized);

      const matchesFilter =
        filter === "All" ||
        (filter === "Refund eligible" && row.refundEligible) ||
        (filter === "Partial" && row.refundState === "partially_refunded") ||
        (filter === "Refunded" && row.refundState === "refunded");

      return matchesQuery && matchesFilter;
    });
  }, [data, query, filter]);

  const eligible =
    data?.returns.filter((row) => row.refundEligible).length ?? 0;
  const partial =
    data?.returns.filter((row) => row.refundState === "partially_refunded").length ?? 0;
  const refunded =
    data?.returns.filter((row) => row.refundState === "refunded").length ?? 0;

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Returns & refunds</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Returns & refunds</h1>
          </div>
          <a
            href="/admin/dashboard"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Back to overview
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">Read-only refund operations</div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-blue-700">
            This view is derived from real order and provider payment state. It does not issue refunds automatically.
            Refund actions stay behind the existing provider-controlled test/payment workflow.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Refund eligible</div>
            <div className="mt-2 text-3xl font-semibold">{eligible}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Partial refunds</div>
            <div className="mt-2 text-3xl font-semibold">{partial}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Fully refunded</div>
            <div className="mt-2 text-3xl font-semibold">{refunded}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order, customer or email"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option>All</option>
            <option>Refund eligible</option>
            <option>Partial</option>
            <option>Refunded</option>
          </select>
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading returns and refunds...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[1fr_120px] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 md:grid-cols-[145px_minmax(0,1fr)_110px_120px_120px_130px]">
              <span>Order</span>
              <span className="hidden md:block">Customer</span>
              <span className="hidden md:block">Provider</span>
              <span className="hidden md:block">Refund state</span>
              <span className="hidden md:block">Refundable</span>
              <span>Total</span>
            </div>

            {visible.map((row) => (
              <div
                key={row.orderId}
                className="grid grid-cols-[1fr_120px] items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0 md:grid-cols-[145px_minmax(0,1fr)_110px_120px_120px_130px]"
              >
                <a
                  href={`/admin/orders/${row.orderId}`}
                  className="text-sm font-semibold text-[#23432d] hover:underline"
                >
                  {row.orderNumber}
                </a>
                <div className="hidden min-w-0 md:block">
                  <div className="truncate text-sm font-medium">{row.customerName}</div>
                  <div className="mt-1 truncate text-xs text-gray-400">{row.customerEmail}</div>
                </div>
                <div className="hidden text-xs capitalize text-gray-600 md:block">
                  {row.provider || "—"}
                </div>
                <div className="hidden md:block">
                  <StatePill value={row.refundState} />
                </div>
                <div className="hidden text-xs font-medium text-gray-700 md:block">
                  {formatMoneyMinor(row.refundableMinor, row.currency)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{formatMoney(row.total, row.currency)}</div>
                  <div className="mt-1 text-[11px] text-gray-400">
                    {row.marketCode} · {row.source}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <h2 className="text-base font-semibold">No matching refund activity</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
              Paid, partially refunded and refunded orders will appear here as payment activity is recorded.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
