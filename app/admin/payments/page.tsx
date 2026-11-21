"use client";

import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { returnedKredalOrderId } from "@/lib/kredal-test-return";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";

type ConnectionResponse = {
  storeId?: string;
  storeName?: string;
  connection?: {
    externalConnectionId?: string;
    status?: string;
    approvedAt?: string | null;
    revokedAt?: string | null;
    metadata?: Record<string, unknown>;
  } | null;
  approveUrl?: string;
  reused?: boolean;
};

type KredalEvent = {
  eventId: string;
  eventType: string;
  sequence?: number | null;
  processingStatus: string;
  processingNote?: string | null;
  receivedAt: string;
  processedAt?: string | null;
};

type EventResponse = {
  total?: number;
  events?: KredalEvent[];
};

type OrderSummary = {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
  paymentStatus: string;
  fulfilmentStatus: string;
};

type OrdersResponse = {
  orders?: OrderSummary[];
};

type TestPaymentResult = {
  orderId?: string;
  orderNumber?: string;
  checkoutUrl?: string | null;
  providerReference?: string;
  providerStatus?: string;
  providerPaymentState?: string;
  providerHoldState?: string | null;
  testMode?: boolean;
  applied?: boolean;
  message?: string;
  state?: { orderPaymentStatus?: string };
  payment?: {
    refunded_minor?: number;
    refunds?: Array<{ id?: string; status?: string }>;
  };
  error?: string;
};

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });

function paymentLabel(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-600">Loading payments…</p>}>
      <PaymentsReturn />
    </Suspense>
  );
}

function PaymentsReturn() {
  const params = useSearchParams();
  const returnedOrder = params.get("kredal_return") === "1" ? returnedKredalOrderId(params.get("order_id")) : "";
  const selectedOrder=returnedKredalOrderId(params.get("order_id"));
  return <PaymentsWorkspace key={returnedOrder||selectedOrder} returnedOrder={returnedOrder} initialOrder={selectedOrder} />;
}

function PaymentsWorkspace({ returnedOrder,initialOrder }: { returnedOrder: string;initialOrder:string }) {
  const [connection, setConnection] = useState<ConnectionResponse | null>(null);
  const [events, setEvents] = useState<KredalEvent[]>([]);
  const [nigeriaOrders, setNigeriaOrders] = useState<OrderSummary[]>([]);
  const [orderId, setOrderId] = useState(returnedOrder||initialOrder);
  const [orderSearch, setOrderSearch] = useState("");
  const verifiedOnReturn = useRef(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testPayment, setTestPayment] = useState<TestPaymentResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [connectionResponse, eventResponse, ordersResponse] = await Promise.all([
        fetch("/api/admin/kredal/connection", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/admin/kredal/events", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/admin/orders", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (
        connectionResponse.status === 401 ||
        eventResponse.status === 401 ||
        ordersResponse.status === 401
      ) {
        const params = new URLSearchParams({ next: "payments" });
        if (returnedOrder||initialOrder) params.set("order_id", returnedOrder||initialOrder);
        window.location.replace("/admin?" + params);
        return;
      }

      const connectionPayload = await connectionResponse.json();
      const eventPayload = (await eventResponse.json()) as EventResponse & {
        error?: string;
      };
      const ordersPayload = (await ordersResponse.json()) as OrdersResponse & {
        error?: string;
      };

      if (!connectionResponse.ok) {
        throw new Error(
          connectionPayload?.error || "Unable to load Kredal connection."
        );
      }

      if (!eventResponse.ok) {
        throw new Error(eventPayload?.error || "Unable to load Kredal events.");
      }

      if (!ordersResponse.ok) {
        throw new Error(ordersPayload?.error || "Unable to load Preview orders.");
      }

      const ngnOrders = Array.isArray(ordersPayload.orders)
        ? ordersPayload.orders.filter((order) => order.currency === "NGN")
        : [];

      setConnection(connectionPayload);
      setEvents(Array.isArray(eventPayload.events) ? eventPayload.events : []);
      setNigeriaOrders(ngnOrders);

      if (ngnOrders.length === 1) setOrderId((current) => current || ngnOrders[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  }, [returnedOrder,initialOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectKredal() {
    setWorking("connect");
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/kredal/connection", {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to start Kredal connection.");
      }

      setConnection(payload);

      const approveUrl =
        payload?.approveUrl ||
        payload?.connection?.metadata?.approveUrl;

      if (typeof approveUrl === "string" && approveUrl) {
        setNotice(
          payload?.reused
            ? "Existing Kredal test connection loaded."
            : "Kredal test connection created. Complete approval in Kredal."
        );
        window.open(approveUrl, "_blank", "noopener,noreferrer");
      } else {
        setNotice("Kredal connection is already available.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to connect Kredal."
      );
    } finally {
      setWorking("");
    }
  }

  async function disconnectKredal() {
    setWorking("disconnect");
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/kredal/connection", {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to disconnect Kredal.");
      }

      setNotice("Kredal test connection disconnected.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to disconnect Kredal."
      );
    } finally {
      setWorking("");
    }
  }

  const paymentAction = useCallback(async (
    method: "POST" | "PUT" | "DELETE",
    action: string
  ) => {
    if (!orderId.trim()) {
      setError("Enter a Zayvi NGN order ID first.");
      return;
    }

    setWorking(action);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/kredal/test-payment", {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim() }),
      });
      const payload = (await response.json()) as TestPaymentResult;

      if (!response.ok) {
        throw new Error(payload?.error || "Kredal test action failed.");
      }

      setTestPayment(payload);

      if (method === "POST" && payload.checkoutUrl) {
        setNotice("Kredal test checkout created. Opening hosted checkout.");
        window.open(payload.checkoutUrl, "_blank", "noopener,noreferrer");
      } else if (method === "POST") {
        setNotice("Kredal created a test payment without a hosted checkout link. Use Verify payment to check its status.");
      } else {
        const state = payload.providerPaymentState || "unknown";
        setNotice(payload.applied
          ? `Kredal status ${state} saved to the Zayvi order.`
          : payload.message || `Kredal reports ${state}. Zayvi left the order status unchanged.`);
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kredal test action failed."
      );
    } finally {
      setWorking("");
    }
  }, [load, orderId]);

  useEffect(() => {
    if (
      !returnedOrder || orderId !== returnedOrder || verifiedOnReturn.current ||
      loading || working || connection?.connection?.status !== "active"
    ) return;

    verifiedOnReturn.current = true;
    void paymentAction("PUT", "verify");
  }, [connection, loading, orderId, paymentAction, returnedOrder, working]);

  async function refundTestPayment() {
    if (!orderId.trim()) {
      setError("Enter a Zayvi NGN order ID first.");
      return;
    }

    setWorking("refund");
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        "/api/admin/kredal/test-payment/refund",
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: orderId.trim() }),
        }
      );
      const payload = (await response.json()) as TestPaymentResult;

      if (!response.ok) {
        throw new Error(payload?.error || "Kredal test refund failed.");
      }

      setTestPayment(payload);
      const state = payload.providerPaymentState || "unknown";
      setNotice(payload.applied
        ? `Kredal status ${state} saved to the Zayvi order.`
        : payload.message || `Refund requested. Kredal reports ${state}. Use Verify payment to check for an update.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kredal test refund failed."
      );
    } finally {
      setWorking("");
    }
  }


  async function catchUpKredalEvents() {
    setWorking("catchup");
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/kredal/catch-up", {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to catch up Kredal events.");
      }

      setNotice(
        `Kredal catch-up complete: ${payload.fetched ?? 0} fetched, ${payload.applied ?? 0} applied, ${payload.duplicates ?? 0} duplicates, last sequence ${payload.lastSequence ?? 0}.`
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to catch up Kredal events."
      );
    } finally {
      setWorking("");
    }
  }

  function selectOrder(id: string) {
    setOrderId(id);
    setTestPayment(null);
    setNotice("");
    setError("");
  }

  const visibleOrders = nigeriaOrders.filter(({ orderNumber }) =>
    orderNumber.toLowerCase().includes(orderSearch.trim().toLowerCase())
  );
  const selectedOrder = nigeriaOrders.find((order) => order.id === orderId);
  const hasOrder = Boolean(orderId.trim());
  const isUnpaidOrder = hasOrder && (
    !selectedOrder || ["unpaid", "pending"].includes(selectedOrder.paymentStatus)
  );
  const isRefundableOrder = hasOrder && (
    !selectedOrder || ["paid", "partially_refunded"].includes(selectedOrder.paymentStatus)
  );
  const connectionStatus = connection?.connection?.status || "not_connected";
  const approvalUrl =
    connection?.approveUrl ||
    (typeof connection?.connection?.metadata?.approveUrl === "string"
      ? connection.connection.metadata.approveUrl
      : "");

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <AdminPageHeading section="Finance" title="Payments" description="Manage provider connections and verify Preview payment events.">
        <Link href="/admin/orders" prefetch={false} className={adminAction}>Orders</Link>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-800">
            Test payments only
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-700">
            Use an eligible Nigeria Preview order to test Kredal Pay. Test payments cannot trigger real fulfilment.
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        <details className="mt-5 rounded-xl border border-[#dfe6e1] bg-white p-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Payment providers & connection settings · {connectionStatus}</summary><div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Kredal Pay
            </div>
            <div className="mt-2 text-lg font-semibold">Nigeria · NGN</div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">Connection</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {loading ? "Loading..." : connectionStatus}
              </span>
            </div>
            {connection?.connection?.externalConnectionId && (
              <div className="mt-3 break-all text-xs text-[#52635b]">
                {connection.connection.externalConnectionId}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => void connectKredal()}
                className="rounded-lg bg-[#17251e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {working === "connect"
                  ? "Connecting..."
                  : connectionStatus === "active"
                    ? "Refresh connection"
                    : "Connect test store"}
              </button>
              {approvalUrl && connectionStatus === "pending" && (
                <a
                  href={approvalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700"
                >
                  Open approval
                </a>
              )}
              {connectionStatus !== "not_connected" &&
                connectionStatus !== "revoked" && (
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => void disconnectKredal()}
                    className="rounded-lg border border-red-100 px-4 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Square
            </div>
            <div className="mt-2 text-lg font-semibold">
              United Kingdom · GBP
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-500">
              Existing UK provider retained. Real payment execution remains
              behind the production release gate.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              PayPal
            </div>
            <div className="mt-2 text-lg font-semibold">
              International alternative
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-500">
              Alternative route retained while the multi-market payment layer
              is completed.
            </p>
          </div>
        </div></details>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold">Order payments · Nigeria test mode</h2>
          <p className="mt-1 text-sm text-[#52635b]">
            Payment and refund updates arrive automatically through signed webhooks.
            Use Refresh to load the latest orders. Verify payment is available if an update is missing.
          </p>

          {nigeriaOrders.length > 0 ? (
            <fieldset disabled={Boolean(working)} className="mt-4">
              <legend className="sr-only">Preview Nigeria orders</legend>
              <label className="block max-w-sm text-sm font-medium">
                Find an order
                <input type="search" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Order number" className="mt-1 min-h-11 w-full rounded-lg border border-[#dfe6e1] px-3 font-normal" />
              </label>
              <ul className="mt-3 max-h-72 divide-y divide-[#dfe6e1] overflow-y-auto rounded-xl border border-[#dfe6e1]">
                {visibleOrders.map((order) => (
                  <li key={order.id}>
                    <label className={`flex min-h-12 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3 hover:bg-[#f5f8f5] ${order.id === orderId ? "bg-[#edf4ee]" : ""}`}>
                      <input type="radio" name="kredal-test-order" checked={order.id === orderId}
                        onChange={() => selectOrder(order.id)} className="size-4 shrink-0 accent-[#215241]" />
                      <span className="min-w-0 flex-1 break-words text-sm font-semibold">{order.orderNumber}</span>
                      <span className="text-sm tabular-nums">{naira.format(order.total)}</span>
                      <span className="rounded-full bg-[#f5f8f5] px-2 py-1 text-xs font-semibold text-[#215241]">{paymentLabel(order.paymentStatus)}</span>
                    </label>
                  </li>
                ))}
                {!visibleOrders.length && <li className="p-3 text-sm text-[#52635b]">No orders match your search.</li>}
              </ul>
            </fieldset>
          ) : !loading && (
            <label className="mt-4 block max-w-sm text-sm font-medium">
              Order UUID
              <input value={orderId} disabled={Boolean(working)} onChange={(event) => selectOrder(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-[#dfe6e1] px-3 font-normal" />
            </label>
          )}

          {hasOrder && (
            <div className="mt-4 rounded-xl border border-[#dfe6e1] bg-[#f5f8f5] p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold">{selectedOrder?.orderNumber || orderId}</span>
                {selectedOrder && (
                  <>
                    <span>{naira.format(selectedOrder.total)}</span>
                    <span className="font-semibold text-[#215241]">{paymentLabel(testPayment?.state?.orderPaymentStatus || selectedOrder.paymentStatus)}</span>
                  </>
                )}
                <span className="text-xs text-[#52635b]">Test mode</span>
              </div>
              {typeof testPayment?.payment?.refunded_minor === "number" && testPayment.payment.refunded_minor > 0 && (
                <p className="mt-1 text-sm text-[#52635b]">{naira.format(testPayment.payment.refunded_minor / 100)} refunded</p>
              )}
              {Array.isArray(testPayment?.payment?.refunds) && (
                <div className="mt-2 text-sm text-[#52635b]">
                  <p>{testPayment.payment.refunds.length} refund {testPayment.payment.refunds.length === 1 ? "record" : "records"} reported by Kredal</p>
                  {testPayment.payment.refunds.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {testPayment.payment.refunds.map((refund, index) => (
                        <li key={refund.id || index} className="break-all">
                          {refund.id || "Reference unavailable"} · {refund.status ? paymentLabel(refund.status) : "Status unavailable"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 grid gap-3 border-t border-[#dfe6e1] pt-5 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              disabled={Boolean(working) || connectionStatus !== "active" || !isUnpaidOrder}
              onClick={() => void paymentAction("POST", "create")}
              className="rounded-xl bg-[#17251e] px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {working === "create" ? "Creating..." : "Create test checkout"}
            </button>
            <button
              type="button"
              disabled={Boolean(working) || !hasOrder}
              onClick={() => void paymentAction("PUT", "verify")}
              className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              {working === "verify" ? "Verifying..." : "Verify payment"}
            </button>
            <button
              type="button"
              disabled={Boolean(working) || !isUnpaidOrder}
              onClick={() => void paymentAction("DELETE", "cancel")}
              className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              {working === "cancel" ? "Cancelling..." : "Cancel unpaid"}
            </button>
            <button
              type="button"
              disabled={Boolean(working) || !isRefundableOrder}
              onClick={() => void refundTestPayment()}
              className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              {working === "refund" ? "Refunding..." : "Refund test payment"}
            </button>
          </div>

          {testPayment && (
            <details className="mt-4 rounded-lg border border-[#dfe6e1] px-3 py-2">
              <summary className="min-h-8 cursor-pointer py-1 text-sm font-medium">Technical details</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[#111814] p-4 text-xs leading-5 text-[#dfe8df]">
                {JSON.stringify(testPayment, null, 2)}
              </pre>
            </details>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
                Kredal webhook event ledger
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Signed events are stored once by event id and applied in Kredal
                sequence order. Missed events can be recovered from the Kredal
                event feed without replaying older state.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void catchUpKredalEvents()}
                disabled={Boolean(working)}
                className="rounded-lg bg-[#17251e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {working === "catchup" ? "Catching up..." : "Catch up events"}
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-gray-400">
                <tr>
                  <th className="pb-3 pr-5">Event</th>
                  <th className="pb-3 pr-5">Sequence</th>
                  <th className="pb-3 pr-5">Type</th>
                  <th className="pb-3 pr-5">State</th>
                  <th className="pb-3">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-gray-400">
                      No Kredal webhook events have been stored yet.
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.eventId}>
                      <td className="py-3 pr-5 font-mono text-[11px]">
                        {event.eventId}
                      </td>
                      <td className="py-3 pr-5 font-mono text-[11px]">
                        {event.sequence ?? "—"}
                      </td>
                      <td className="py-3 pr-5 font-medium">
                        {event.eventType}
                      </td>
                      <td className="py-3 pr-5">
                        {event.processingStatus}
                      </td>
                      <td className="py-3">
                        {new Date(event.receivedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
