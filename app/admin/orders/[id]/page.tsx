"use client";

import { use, useEffect, useState } from "react";

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
  selectedOptions: Record<string, string>;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  marketCode: string;
  currency: string;
  orderStatus: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadOrder() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load order.");
      }

      setOrder(payload.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load order.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function updateStatuses(update: {
    orderStatus?: string;
    fulfilmentStatus?: string;
  }) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update order.");
      }

      setOrder(payload.order);
      setNotice("Order updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7f8f6] p-10 text-sm text-gray-500">Loading order...</main>;
  }

  if (!order) {
    return <main className="min-h-screen bg-[#f7f8f6] p-10 text-sm text-red-700">{error || "Order not found."}</main>;
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <a href="/admin/orders" className="text-xs text-gray-400 hover:text-gray-600">← Orders</a>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">{order.orderNumber}</h1>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>{new Date(order.createdAt).toLocaleString("en-GB")}</div>
            <div className="mt-1">{order.marketCode} · {order.currency}</div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1200px] gap-6 px-5 py-8 md:grid-cols-[minmax(0,1fr)_340px] md:px-9">
        <div>
          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4 text-sm font-semibold">Items</div>
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-5 border-b border-gray-100 px-5 py-4 last:border-b-0">
                <div className="min-w-0">
                  <div className="font-medium">{item.productName}</div>
                  <div className="mt-1 text-xs text-gray-400">{item.sku || item.productId}</div>
                  {Object.keys(item.selectedOptions || {}).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {Object.entries(item.selectedOptions).map(([key, value]) => `${key}: ${value}`).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">£{Number(item.lineTotal).toFixed(2)}</div>
                  <div className="mt-1 text-xs text-gray-400">{item.quantity} × £{Number(item.unitPrice).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Customer</h2>
            <div className="mt-3 text-sm font-medium">{order.customerName}</div>
            <div className="mt-1 text-sm text-gray-500">{order.customerEmail}</div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Order totals</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>£{order.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>£{order.shippingTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>£{order.taxTotal.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-3 font-semibold"><span>Total</span><span>£{order.total.toFixed(2)}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Status controls</h2>
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500">Order status</label>
              <select
                value={order.orderStatus}
                disabled={saving}
                onChange={(event) => updateStatuses({ orderStatus: event.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="pending_payment">Pending payment</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500">Payment status</label>
              <div className="mt-1 rounded-xl bg-gray-50 px-3 py-2 text-sm capitalize">{order.paymentStatus.replaceAll("_", " ")}</div>
              <p className="mt-1 text-[11px] leading-4 text-gray-400">Read-only. Payment providers control this status.</p>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500">Fulfilment status</label>
              <select
                value={order.fulfilmentStatus}
                disabled={saving}
                onChange={(event) => updateStatuses({ fulfilmentStatus: event.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="unfulfilled">Unfulfilled</option>
                <option value="processing">Processing</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {notice && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</div>}
            {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            Payments remain disabled in Preview. Unpaid orders cannot be confirmed or enter fulfilment.
          </div>
        </aside>
      </section>
    </main>
  );
}
