"use client";

import Link from "next/link";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

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

type PaymentAttempt = {
  id: string;
  provider: string;
  providerReference?: string | null;
  status: string;
  amount: number;
  currency: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  providerState?: string | null;
  holdState?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaymentEvent = {
  eventId: string;
  eventType: string;
  sequence?: number | null;
  processingStatus: string;
  processingNote?: string | null;
  receivedAt: string;
  processedAt?: string | null;
};

type FulfilmentAllocation = {
  id: string;
  orderItemId: string;
  productName: string;
  sku?: string | null;
  sourceType: "own_stock" | "supplier";
  sourceName: string;
  supplierSku?: string | null;
  quantity: number;
  unitCost: number | null;
  currency: string;
  expectedLeadTimeDays: number | null;
  score: number | null;
  rationale: Record<string, unknown>;
  reservationStatus: string;
  executionStatus: "pending" | "dispatched" | "delivered" | "cancelled";
  carrier?: string | null;
  trackingNumber?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  onHand: number | null;
  reserved: number | null;
  safetyStock: number | null;
};

type FulfilmentPlan = {
  id: string;
  orderId: string;
  status: "draft" | "approved" | "cancelled" | "completed";
  recommendationVersion: string;
  rationale: {
    complete?: boolean;
    blockedItems?: Array<{
      orderItemId: string;
      productName: string;
      reason: string;
    }>;
  };
  approvedBy?: string | null;
  approvedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  allocations: FulfilmentAllocation[];
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
  fulfilmentSafety: {
    blocked: boolean;
    reason?: string | null;
  };
  paymentAttempt?: PaymentAttempt | null;
  paymentEvents: PaymentEvent[];
  items: OrderItem[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(Number(value || 0));
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const positive = ["paid", "succeeded", "captured", "applied", "active"].includes(normalized);
  const warning = ["pending", "created", "held", "processing", "stored"].includes(normalized);

  return (
    <span
      className={
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold " +
        (positive
          ? "bg-emerald-50 text-emerald-700"
          : warning
            ? "bg-amber-50 text-amber-700"
            : "bg-gray-100 text-gray-600")
      }
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

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
  const [fulfilmentPlan, setFulfilmentPlan] = useState<FulfilmentPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planWorking, setPlanWorking] = useState(false);
  const [allocationWorkingId, setAllocationWorkingId] = useState("");

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

  async function loadFulfilmentPlan() {
    setPlanLoading(true);

    try {
      const response = await fetch(
        `/api/admin/orders/${id}/fulfilment-plan`,
        { credentials: "include", cache: "no-store" }
      );

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load fulfilment plan.");
      }

      setFulfilmentPlan(payload.plan || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load fulfilment plan."
      );
    } finally {
      setPlanLoading(false);
    }
  }

  useEffect(() => {
    void loadOrder();
    void loadFulfilmentPlan();
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

  async function planAction(
    action: "generate" | "approve" | "cancel"
  ) {
    setPlanWorking(true);
    setError("");
    setNotice("");

    try {
      const suffix =
        action === "generate"
          ? ""
          : action === "approve"
            ? "/approve"
            : "/cancel";

      const response = await fetch(
        `/api/admin/orders/${id}/fulfilment-plan${suffix}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (action === "generate"
              ? "Unable to generate fulfilment plan."
              : action === "approve"
                ? "Unable to approve fulfilment plan."
                : "Unable to cancel fulfilment plan.")
        );
      }

      setNotice(
        action === "generate"
          ? "Fulfilment plan generated for review."
          : action === "approve"
            ? "Fulfilment plan approved and owned stock reserved."
            : "Fulfilment plan cancelled and reservations released."
      );

      await Promise.all([loadOrder(), loadFulfilmentPlan()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update fulfilment plan."
      );
    } finally {
      setPlanWorking(false);
    }
  }

  async function executionAction(
    allocation: FulfilmentAllocation,
    action: "dispatch" | "deliver"
  ) {
    setAllocationWorkingId(allocation.id);
    setError("");
    setNotice("");

    let carrier: string | null = allocation.carrier || null;
    let trackingNumber: string | null = allocation.trackingNumber || null;

    if (action === "dispatch") {
      const enteredCarrier = window.prompt(
        "Carrier (optional)",
        allocation.carrier || ""
      );
      if (enteredCarrier === null) {
        setAllocationWorkingId("");
        return;
      }

      const enteredTracking = window.prompt(
        "Tracking number (optional)",
        allocation.trackingNumber || ""
      );
      if (enteredTracking === null) {
        setAllocationWorkingId("");
        return;
      }

      carrier = enteredCarrier.trim() || null;
      trackingNumber = enteredTracking.trim() || null;
    }

    try {
      const response = await fetch(
        `/api/admin/orders/${id}/fulfilment-plan/allocations/${allocation.id}/execution`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, carrier, trackingNumber }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (action === "dispatch"
              ? "Unable to mark allocation dispatched."
              : "Unable to mark allocation delivered.")
        );
      }

      setNotice(
        action === "dispatch"
          ? "Allocation marked dispatched."
          : "Allocation marked delivered."
      );

      await Promise.all([loadOrder(), loadFulfilmentPlan()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update fulfilment execution."
      );
    } finally {
      setAllocationWorkingId("");
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
      <AdminPageHeading section="Orders" title={order.orderNumber} description={`${order.marketCode} · ${order.currency} · ${new Date(order.createdAt).toLocaleString("en-GB")}`}>
        <Link href="/admin/orders" prefetch={false} className={adminAction}>All orders</Link>
      </AdminPageHeading>

      <section className="mx-auto grid max-w-[1200px] gap-6 px-4 py-5 sm:px-7 lg:px-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4 text-sm font-semibold">Items</div>
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-5 border-b border-gray-100 px-5 py-4 last:border-b-0">
                <div className="min-w-0">
                  <div className="font-medium">{item.productName}</div>
                  <div className="mt-1 text-xs text-[#52635b]">{item.sku || item.productId}</div>
                  {Object.keys(item.selectedOptions || {}).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {Object.entries(item.selectedOptions).map(([key, value]) => `${key}: ${value}`).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{formatMoney(item.lineTotal, item.currency)}</div>
                  <div className="mt-1 text-xs text-[#52635b]">{item.quantity} × {formatMoney(item.unitPrice, item.currency)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Customer</h2>
            <div className="mt-3 text-sm font-medium">{order.customerName}</div>
            <div className="mt-1 text-sm text-gray-500">{order.customerEmail}</div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Fulfilment plan</h2>
                <p className="mt-1 text-xs leading-5 text-gray-400">
                  Human-approved source allocation. Supplier plans do not contact or dispatch to suppliers automatically.
                </p>
              </div>
              {fulfilmentPlan && <StatusPill value={fulfilmentPlan.status} />}
            </div>

            {planLoading ? (
              <div className="mt-4 text-sm text-gray-400">Loading fulfilment plan...</div>
            ) : fulfilmentPlan ? (
              <>
                <div className="mt-4 space-y-3">
                  {fulfilmentPlan.allocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="rounded-xl border border-gray-100 bg-[#fafbf9] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{allocation.productName}</div>
                          <div className="mt-1 text-xs text-[#52635b]">
                            {allocation.quantity} unit(s) · {allocation.sourceName}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-wide text-gray-400">
                            {allocation.sourceType === "own_stock" ? "Own stock" : "Supplier"}
                          </div>
                          <div className="mt-1 text-xs font-semibold capitalize">
                            {allocation.reservationStatus.replaceAll("_", " ")}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-5">
                        <div>
                          <div className="text-gray-400">Score</div>
                          <div className="mt-1 font-semibold">{allocation.score ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Unit cost</div>
                          <div className="mt-1 font-semibold">
                            {allocation.unitCost === null
                              ? "Internal"
                              : formatMoney(allocation.unitCost, allocation.currency)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Lead time</div>
                          <div className="mt-1 font-semibold">
                            {allocation.expectedLeadTimeDays === null
                              ? "Unknown"
                              : `${allocation.expectedLeadTimeDays} day(s)`}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Reservation</div>
                          <div className="mt-1 font-semibold capitalize">
                            {allocation.reservationStatus.replaceAll("_", " ")}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Execution</div>
                          <div className="mt-1 font-semibold capitalize">
                            {allocation.executionStatus.replaceAll("_", " ")}
                          </div>
                        </div>
                      </div>

                      {(allocation.carrier || allocation.trackingNumber) && (
                        <div className="mt-3 rounded-lg bg-white px-3 py-2 text-[11px] text-gray-500">
                          {allocation.carrier ? `Carrier: ${allocation.carrier}` : "Carrier not recorded"}
                          {allocation.trackingNumber
                            ? ` · Tracking: ${allocation.trackingNumber}`
                            : ""}
                        </div>
                      )}

                      {typeof allocation.rationale?.reason === "string" && (
                        <div className="mt-3 text-[11px] leading-4 text-gray-500">
                          {allocation.rationale.reason}
                        </div>
                      )}

                      {fulfilmentPlan.status === "approved" && (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                          {allocation.executionStatus === "pending" && (
                            <button
                              type="button"
                              disabled={allocationWorkingId === allocation.id}
                              onClick={() => void executionAction(allocation, "dispatch")}
                              className="rounded-lg bg-[#17251e] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                            >
                              Mark dispatched
                            </button>
                          )}

                          {allocation.executionStatus === "dispatched" && (
                            <button
                              type="button"
                              disabled={allocationWorkingId === allocation.id}
                              onClick={() => void executionAction(allocation, "deliver")}
                              className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                            >
                              Mark delivered
                            </button>
                          )}

                          {allocation.sourceType === "supplier" &&
                            allocation.executionStatus === "pending" && (
                              <span className="self-center text-[10px] text-amber-700">
                                This confirms an external action already taken; Zayvi will not contact the supplier.
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {(fulfilmentPlan.rationale.blockedItems?.length ?? 0) > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <div className="text-xs font-semibold text-amber-800">Unresolved items</div>
                    <div className="mt-2 space-y-1">
                      {fulfilmentPlan.rationale.blockedItems?.map((item) => (
                        <div key={item.orderItemId} className="text-[11px] leading-4 text-amber-700">
                          {item.productName}: {item.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {fulfilmentPlan.status === "draft" && (
                    <>
                      <button
                        type="button"
                        disabled={planWorking}
                        onClick={() => void planAction("generate")}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 disabled:opacity-40"
                      >
                        Recalculate plan
                      </button>
                      <button
                        type="button"
                        disabled={
                          planWorking ||
                          fulfilmentPlan.rationale.complete !== true ||
                          order.fulfilmentSafety.blocked
                        }
                        onClick={() => void planAction("approve")}
                        className="rounded-xl bg-[#17251e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Approve & reserve stock
                      </button>
                    </>
                  )}

                  {["draft", "approved"].includes(fulfilmentPlan.status) && (
                    <button
                      type="button"
                      disabled={planWorking}
                      onClick={() => void planAction("cancel")}
                      className="rounded-xl border border-red-100 px-4 py-2 text-xs font-semibold text-red-600 disabled:opacity-40"
                    >
                      Cancel plan
                    </button>
                  )}
                </div>

                {fulfilmentPlan.status === "draft" && order.fulfilmentSafety.blocked && (
                  <p className="mt-3 text-[11px] leading-4 text-amber-700">
                    This plan can be reviewed, but approval is blocked: {order.fulfilmentSafety.reason}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-4">
                <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                  No fulfilment plan exists for this order.
                </div>
                <button
                  type="button"
                  disabled={planWorking}
                  onClick={() => void planAction("generate")}
                  className="mt-3 rounded-xl bg-[#17251e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Generate fulfilment plan
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Payment evidence</h2>
                <p className="mt-1 text-xs text-[#52635b]">
                  Provider-controlled payment state and reconciliation history.
                </p>
              </div>
              <StatusPill value={order.paymentStatus} />
            </div>

            {order.paymentAttempt ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#fafbf9] p-4">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">Provider</div>
                  <div className="mt-1 text-sm font-semibold capitalize">{order.paymentAttempt.provider}</div>
                  <div className="mt-2"><StatusPill value={order.paymentAttempt.status} /></div>
                </div>
                <div className="rounded-xl bg-[#fafbf9] p-4">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">Amount</div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatMoney(order.paymentAttempt.amount, order.paymentAttempt.currency)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Provider state: {order.paymentAttempt.providerState || "—"}
                    {order.paymentAttempt.holdState ? ` · hold: ${order.paymentAttempt.holdState}` : ""}
                  </div>
                </div>
                <div className="rounded-xl bg-[#fafbf9] p-4 sm:col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">Provider reference</div>
                  <div className="mt-1 break-all font-mono text-xs text-gray-700">
                    {order.paymentAttempt.providerReference || "Not assigned"}
                  </div>
                </div>
                {(order.paymentAttempt.failureCode || order.paymentAttempt.failureMessage) && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700 sm:col-span-2">
                    {[order.paymentAttempt.failureCode, order.paymentAttempt.failureMessage]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                No payment attempt has been recorded for this order yet.
              </div>
            )}

            {order.paymentEvents.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold text-gray-500">Recent payment events</div>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {order.paymentEvents.slice(0, 8).map((event) => (
                    <div key={event.eventId} className="flex items-start justify-between gap-4 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-gray-800">{event.eventType}</div>
                        <div className="mt-1 text-[11px] text-gray-400">
                          {new Date(event.receivedAt).toLocaleString("en-GB")}
                          {event.sequence !== null && event.sequence !== undefined ? ` · seq ${event.sequence}` : ""}
                        </div>
                        {event.processingNote && (
                          <div className="mt-1 text-[11px] leading-4 text-gray-500">{event.processingNote}</div>
                        )}
                      </div>
                      <StatusPill value={event.processingStatus} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Order totals</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatMoney(order.subtotal, order.currency)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{formatMoney(order.shippingTotal, order.currency)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatMoney(order.taxTotal, order.currency)}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-3 font-semibold"><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div>
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
                <option value="processing" disabled={order.fulfilmentSafety.blocked}>Processing</option>
                <option value="fulfilled" disabled={order.fulfilmentSafety.blocked}>Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {notice && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</div>}
            {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}
          </div>

          <div
            className={
              "rounded-2xl border p-4 text-xs leading-5 " +
              (order.fulfilmentSafety.blocked
                ? "border-amber-100 bg-amber-50 text-amber-800"
                : "border-emerald-100 bg-emerald-50 text-emerald-800")
            }
          >
            <div className="font-semibold">
              {order.fulfilmentSafety.blocked ? "Fulfilment blocked" : "Fulfilment eligible"}
            </div>
            <div className="mt-1">
              {order.fulfilmentSafety.reason ||
                "Payment is confirmed and this is not a Preview/test order."}
            </div>
            <div className="mt-2 text-[11px] opacity-80">
              Source: {order.source} · Payment: {order.paymentStatus}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
