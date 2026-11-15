"use client";

import { useEffect, useMemo, useState } from "react";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  currency: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  createdAt: string;
};

type OrdersResponse = {
  source: string;
  total: number;
  orders: Order[];
  purchasingEnabled: boolean;
  message?: string;
};

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
  const [status, setStatus] = useState("All");
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

  const visibleOrders = useMemo(() => {
    const orders = data?.orders ?? [];
    const normalized = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !normalized ||
        order.orderNumber.toLowerCase().includes(normalized) ||
        order.customerName.toLowerCase().includes(normalized) ||
        order.customerEmail.toLowerCase().includes(normalized);

      const matchesStatus =
        status === "All" ||
        order.paymentStatus === status ||
        order.fulfilmentStatus === status;

      return matchesSearch && matchesStatus;
    });
  }, [data, query, status]);

  const paid = data?.orders.filter((order) => order.paymentStatus === "paid").length ?? 0;
  const unfulfilled =
    data?.orders.filter((order) => order.fulfilmentStatus === "unfulfilled").length ?? 0;
  const revenue =
    data?.orders.reduce((sum, order) => sum + Number(order.total || 0), 0) ?? 0;

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Orders</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Orders</h1>
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
        <div className="rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5">
          <div className="text-sm font-semibold text-[#23432d]">
            Orders workspace is connected to the Preview backend
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#55705b]">
            Order persistence is now part of the Preview commerce model. Customer
            checkout and payment processing remain disabled until fulfilment and
            payment controls are completed.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Total orders</div>
            <div className="mt-2 text-3xl font-semibold">{data?.total ?? "—"}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Paid</div>
            <div className="mt-2 text-3xl font-semibold">{paid}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Unfulfilled</div>
            <div className="mt-2 text-3xl font-semibold">{unfulfilled}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Order value</div>
            <div className="mt-2 text-3xl font-semibold">£{revenue.toFixed(2)}</div>
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
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option>All</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending payment</option>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">Loading orders...</div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visibleOrders.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[1fr_110px_120px] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 md:grid-cols-[150px_minmax(0,1fr)_130px_130px_120px_120px]">
              <span>Order</span>
              <span className="hidden md:block">Customer</span>
              <span className="hidden md:block">Payment</span>
              <span className="hidden md:block">Fulfilment</span>
              <span>Total</span>
              <span>Date</span>
            </div>

            {visibleOrders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1fr_110px_120px] items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0 md:grid-cols-[150px_minmax(0,1fr)_130px_130px_120px_120px]"
              >
                <div className="text-sm font-semibold">{order.orderNumber}</div>
                <div className="hidden min-w-0 md:block">
                  <div className="truncate text-sm font-medium">{order.customerName}</div>
                  <div className="mt-1 truncate text-xs text-gray-400">
                    {order.customerEmail}
                  </div>
                </div>
                <div className="hidden md:block">
                  <StatusPill value={order.paymentStatus} />
                </div>
                <div className="hidden md:block">
                  <StatusPill value={order.fulfilmentStatus} />
                </div>
                <div className="text-sm font-semibold">
                  {order.currency === "GBP" ? "£" : ""}
                  {Number(order.total).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString("en-GB")}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && visibleOrders.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ed] text-xl text-[#31543b]">
              ▤
            </div>
            <h2 className="mt-5 text-base font-semibold">No orders yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
              {data?.message ||
                "Orders will appear here when customers begin purchasing from the storefront."}
            </p>
            <div className="mt-5 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Payments disabled in Preview
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
