"use client";

import { useEffect, useState } from "react";

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
  error?: string;
};

export default function AdminPaymentsPage() {
  const [connection, setConnection] = useState<ConnectionResponse | null>(null);
  const [events, setEvents] = useState<KredalEvent[]>([]);
  const [eligibleOrders, setEligibleOrders] = useState<OrderSummary[]>([]);
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testPayment, setTestPayment] = useState<TestPaymentResult | null>(null);

  async function load() {
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
        window.location.href = "/admin";
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
        ? ordersPayload.orders.filter(
            (order) =>
              order.currency === "NGN" &&
              !["paid", "refunded", "cancelled"].includes(
                order.paymentStatus.toLowerCase()
              )
          )
        : [];

      setConnection(connectionPayload);
      setEvents(Array.isArray(eventPayload.events) ? eventPayload.events : []);
      setEligibleOrders(ngnOrders);

      if (!orderId && ngnOrders.length === 1) {
        setOrderId(ngnOrders[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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

  async function paymentAction(
    method: "POST" | "PUT" | "DELETE",
    action: string
  ) {
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
      } else if (method === "PUT") {
        setNotice(
          "Kredal payment status verified from the provider and reconciled."
        );
      } else {
        setNotice("Kredal test payment cancellation checked and reconciled.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kredal test action failed."
      );
    } finally {
      setWorking("");
    }
  }

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
      setNotice("Kredal test refund requested and provider status checked.");
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

  const connectionStatus = connection?.connection?.status || "not_connected";
  const approvalUrl =
    connection?.approveUrl ||
    (typeof connection?.connection?.metadata?.approveUrl === "string"
      ? connection.connection.metadata.approveUrl
      : "");

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Finance</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Payments
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
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-800">
            Test payments only
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-700">
            Kredal integration is restricted to test mode. Test-paid orders are
            blocked from real fulfilment even when their simulated provider
            status is paid.
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

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
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
              <div className="mt-3 break-all text-xs text-gray-400">
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
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold">Kredal end-to-end test</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Use an existing Preview Nigeria order. Zayvi reads the amount from
            PostgreSQL, sends the exact NGN total to Kredal in kobo, and stores
            the payment attempt before any status can affect the order.
          </p>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            {eligibleOrders.length > 0 ? (
              <select
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#78927d]"
              >
                <option value="">Select a Preview Nigeria order</option>
                {eligibleOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} · NGN {Number(order.total).toFixed(2)} · {order.paymentStatus}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="No eligible NGN orders found — paste order UUID"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
              />
            )}
            <button
              type="button"
              disabled={Boolean(working) || connectionStatus !== "active"}
              onClick={() => void paymentAction("POST", "create")}
              className="rounded-xl bg-[#17251e] px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {working === "create" ? "Creating..." : "Create test checkout"}
            </button>
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => void paymentAction("PUT", "verify")}
              className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              {working === "verify" ? "Verifying..." : "Verify payment"}
            </button>
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => void paymentAction("DELETE", "cancel")}
              className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              {working === "cancel" ? "Cancelling..." : "Cancel unpaid"}
            </button>
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => void refundTestPayment()}
              className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              {working === "refund" ? "Refunding..." : "Refund test payment"}
            </button>
          </div>

          {testPayment && (
            <pre className="mt-5 overflow-x-auto rounded-xl bg-[#111814] p-4 text-xs leading-5 text-[#dfe8df]">
              {JSON.stringify(testPayment, null, 2)}
            </pre>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">
                Kredal webhook event ledger
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Signed events are stored once by event id and applied in Kredal
                sequence order. Missed events can be recovered from Kredal's
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
