"use client";

import { useEffect, useMemo, useState } from "react";

type OrderSummary = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  currency: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  orderStatus: string;
  createdAt: string;
};

type OrderItem = {
  id: string;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  currency: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  items: OrderItem[];
};

type ReturnRow = {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  marketCode: string;
  status: string;
  reason: string;
  refundStatus: string;
  requestedRefundAmount: number;
  currency: string;
  quantityRequested: number;
  quantityReceived: number;
  quantityRestocked: number;
  requestedAt: string;
  updatedAt: string;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(Number(value || 0));
}

function pill(value: string) {
  if (["completed", "refunded", "received"].includes(value)) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (["requested", "approved", "pending_provider", "partially_refunded"].includes(value)) {
    return "bg-amber-50 text-amber-700";
  }
  if (["rejected", "cancelled"].includes(value)) {
    return "bg-red-50 text-red-700";
  }
  return "bg-gray-100 text-gray-600";
}

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [returnsResponse, ordersResponse] = await Promise.all([
        fetch("/api/admin/returns", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/admin/orders", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (returnsResponse.status === 401 || ordersResponse.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const returnsPayload = await returnsResponse.json();
      const ordersPayload = await ordersResponse.json();

      if (!returnsResponse.ok) {
        throw new Error(returnsPayload?.error || "Unable to load returns.");
      }
      if (!ordersResponse.ok) {
        throw new Error(ordersPayload?.error || "Unable to load orders.");
      }

      setReturns(Array.isArray(returnsPayload.returns) ? returnsPayload.returns : []);
      setOrders(
        Array.isArray(ordersPayload.orders)
          ? ordersPayload.orders.filter((item: OrderSummary) =>
              ["paid", "partially_refunded"].includes(item.paymentStatus)
            )
          : []
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load returns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setQuantities({});
      return;
    }

    async function loadOrder() {
      setError("");
      try {
        const response = await fetch(
          "/api/admin/orders/" + encodeURIComponent(orderId),
          {
            credentials: "include",
            cache: "no-store",
          }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load order detail.");
        }

        setOrder(payload.order || payload);
        const next: Record<string, string> = {};
        for (const item of (payload.order || payload).items || []) {
          next[item.id] = "0";
        }
        setQuantities(next);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load order detail."
        );
      }
    }

    void loadOrder();
  }, [orderId]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();

    return returns.filter((item) => {
      const matchesQuery =
        !term ||
        item.returnNumber.toLowerCase().includes(term) ||
        item.orderNumber.toLowerCase().includes(term) ||
        item.customerName.toLowerCase().includes(term) ||
        item.customerEmail.toLowerCase().includes(term);

      const matchesStatus = status === "all" || item.status === status;

      return matchesQuery && matchesStatus;
    });
  }, [returns, query, status]);

  async function createReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order) {
      setError("Select a paid order first.");
      return;
    }

    const items = order.items
      .map((item) => ({
        orderItemId: item.id,
        quantity: Number(quantities[item.id] || 0),
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      setError("Select at least one item quantity to return.");
      return;
    }

    setWorking(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/returns", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          reason,
          items,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to create return.");
      }

      setNotice(
        `${payload.return?.returnNumber || "Return"} created and awaiting review.`
      );
      setOrderId("");
      setOrder(null);
      setReason("");
      setQuantities({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create return.");
    } finally {
      setWorking(false);
    }
  }

  const activeCount = returns.filter((item) =>
    ["requested", "approved", "received"].includes(item.status)
  ).length;
  const pendingRefunds = returns.filter(
    (item) => item.refundStatus === "pending_provider"
  ).length;
  const restocked = returns.reduce(
    (sum, item) => sum + Number(item.quantityRestocked || 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Returns</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Returns & reverse inventory
            </h1>
          </div>
          <a
            href="/admin/dashboard"
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Back to overview
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">
            Review and inspection required
          </div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            Creating a return does not restock goods or change payment state.
            Stock only re-enters owned inventory after receipt and inspection.
            Refund reconciliation reads provider-controlled order payment state.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Active returns</div>
            <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Refund pending provider</div>
            <div className="mt-2 text-3xl font-semibold">{pendingRefunds}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Units restocked</div>
            <div className="mt-2 text-3xl font-semibold">{restocked}</div>
          </div>
        </div>

        {notice && (
          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={createReturn}
          className="mt-6 rounded-2xl border border-gray-200 bg-white p-5"
        >
          <div>
            <h2 className="text-sm font-semibold">Create return request</h2>
            <p className="mt-1 text-xs text-gray-400">
              Select a paid order and the exact quantities being returned.
            </p>
          </div>

          <select
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">Select paid order</option>
            {orders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.orderNumber} · {item.customerName} ·{" "}
                {money(item.total, item.currency)}
              </option>
            ))}
          </select>

          {order && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_120px_140px]"
                >
                  <div>
                    <div className="text-sm font-semibold">{item.productName}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {item.sku || "No SKU"} · ordered {item.quantity} ·{" "}
                      {money(item.unitPrice, item.currency)} each
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 md:text-right">
                    {money(item.lineTotal, item.currency)}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    step="1"
                    value={quantities[item.id] || "0"}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    aria-label={`Return quantity for ${item.productName}`}
                  />
                </div>
              ))}
            </div>
          )}

          <textarea
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Reason for return"
            className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={working || !order}
              className="rounded-xl bg-[#17251e] px-5 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {working ? "Creating..." : "Create return"}
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search return, order or customer"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="received">Received</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading returns...
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <h2 className="text-base font-semibold">No matching returns</h2>
            <p className="mt-2 text-sm text-gray-500">
              Create a return from a paid order when goods need to come back.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="divide-y divide-gray-100">
              {visible.map((item) => (
                <a
                  key={item.id}
                  href={`/admin/returns/${item.id}`}
                  className="grid gap-4 px-5 py-4 hover:bg-[#fafbf9] md:grid-cols-[160px_minmax(0,1fr)_140px_140px_140px]"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#23432d]">
                      {item.returnNumber}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {item.orderNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{item.customerName}</div>
                    <div className="mt-1 truncate text-xs text-gray-400">
                      {item.reason}
                    </div>
                  </div>
                  <div>
                    <span
                      className={
                        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                        pill(item.status)
                      }
                    >
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Refund</div>
                    <div className="mt-1 text-sm font-semibold">
                      {money(item.requestedRefundAmount, item.currency)}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      {item.refundStatus.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {item.quantityRequested} requested · {item.quantityReceived} received ·{" "}
                    {item.quantityRestocked} restocked
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
