"use client";

import Link from "next/link";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

import { use, useEffect, useState } from "react";

type ReturnItem = {
  id: string;
  orderItemId: string;
  tenantProductId: string;
  productName: string;
  sku?: string | null;
  orderedQuantity: number;
  unitPrice: number;
  quantityRequested: number;
  quantityReceived: number;
  quantityRestocked: number;
  condition: string;
  restockDecision: string;
  refundAmount: number;
};

type ReturnDetail = {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  marketCode: string;
  orderPaymentStatus: string;
  orderFulfilmentStatus: string;
  orderSource: string;
  status: string;
  reason: string;
  reviewNote?: string | null;
  inspectionNote?: string | null;
  refundStatus: string;
  requestedRefundAmount: number;
  currency: string;
  requestedAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  receivedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
  items: ReturnItem[];
};

type InspectionState = {
  quantityReceived: string;
  condition: "new" | "opened" | "damaged" | "faulty";
  restockDecision: "restock" | "do_not_restock";
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(Number(value || 0));
}

function statusClass(value: string) {
  if (["completed", "received", "refunded"].includes(value)) {
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

export default function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<ReturnDetail | null>(null);
  const [inspection, setInspection] = useState<Record<string, InspectionState>>({});
  const [inspectionNote, setInspectionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/returns/" + encodeURIComponent(id),
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load return.");
      }

      const next = payload.return as ReturnDetail;
      setData(next);

      const nextInspection: Record<string, InspectionState> = {};
      for (const item of next.items || []) {
        nextInspection[item.orderItemId] = {
          quantityReceived: String(item.quantityRequested),
          condition: item.condition === "pending_inspection" ? "new" : (item.condition as InspectionState["condition"]),
          restockDecision:
            item.restockDecision === "pending"
              ? "restock"
              : (item.restockDecision as InspectionState["restockDecision"]),
        };
      }
      setInspection(nextInspection);
      setInspectionNote(next.inspectionNote || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load return.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function act(
    action: "approve" | "reject" | "cancel" | "receive" | "reconcile_refund" | "complete"
  ) {
    if (!data) return;

    let body: Record<string, unknown> = { action };

    if (action === "approve") {
      const note = window.prompt("Approval note (optional)", data.reviewNote || "");
      if (note === null) return;
      body.reviewNote = note.trim() || null;
    }

    if (action === "reject") {
      const note = window.prompt("Reason for rejection", data.reviewNote || "");
      if (note === null) return;
      if (!note.trim()) {
        setError("A rejection note is required.");
        return;
      }
      body.reviewNote = note.trim();
    }

    if (action === "cancel") {
      if (!window.confirm("Cancel this return request?")) return;
    }

    if (action === "receive") {
      body.inspectionNote = inspectionNote.trim() || null;
      body.items = data.items.map((item) => ({
        orderItemId: item.orderItemId,
        quantityReceived: Number(
          inspection[item.orderItemId]?.quantityReceived ?? item.quantityRequested
        ),
        condition: inspection[item.orderItemId]?.condition || "new",
        restockDecision:
          inspection[item.orderItemId]?.restockDecision || "do_not_restock",
      }));
    }

    setWorking(action);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        "/api/admin/returns/" + encodeURIComponent(data.id),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update return.");
      }

      setNotice(
        action === "reconcile_refund"
          ? "Refund state reconciled from provider-controlled payment status."
          : action === "receive"
            ? "Return received and inspected. Approved restock quantities were added to owned inventory."
            : `Return ${action.replaceAll("_", " ")} completed.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update return.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f6] p-10 text-sm text-gray-500">
        Loading return...
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f7f8f6] p-10 text-sm text-red-700">
        {error || "Return not found."}
      </main>
    );
  }

  const canComplete =
    data.status === "received" &&
    (data.requestedRefundAmount === 0 ||
      ["partially_refunded", "refunded"].includes(data.refundStatus));

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <AdminPageHeading section="Returns" title={data.returnNumber} description={`${data.orderNumber} · ${data.customerName}`}>
        <Link href="/admin/returns" prefetch={false} className={adminAction}>All returns</Link>
        <span className={"rounded-full px-3 py-1 text-xs font-semibold " + statusClass(data.status)}>{data.status.replaceAll("_", " ")}</span>
        <span className={"rounded-full px-3 py-1 text-xs font-semibold " + statusClass(data.refundStatus)}>Refund: {data.refundStatus.replaceAll("_", " ")}</span>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1300px] px-4 py-5 sm:px-7 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Requested refund</div>
            <div className="mt-2 text-xl font-semibold">
              {money(data.requestedRefundAmount, data.currency)}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Payment state</div>
            <div className="mt-2 text-lg font-semibold capitalize">
              {data.orderPaymentStatus.replaceAll("_", " ")}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Fulfilment</div>
            <div className="mt-2 text-lg font-semibold capitalize">
              {data.orderFulfilmentStatus.replaceAll("_", " ")}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Market</div>
            <div className="mt-2 text-lg font-semibold">
              {data.marketCode} · {data.currency}
            </div>
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

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Return reason</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{data.reason}</p>
          {data.reviewNote && (
            <p className="mt-3 text-xs leading-5 text-gray-500">
              Review note: {data.reviewNote}
            </p>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Return items</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {data.items.map((item) => {
              const state = inspection[item.orderItemId];

              return (
                <div key={item.id} className="px-5 py-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_110px_120px_120px]">
                    <div>
                      <div className="text-sm font-semibold">{item.productName}</div>
                      <div className="mt-1 text-xs text-[#52635b]">
                        {item.sku || "No SKU"} · ordered {item.orderedQuantity} ·{" "}
                        {money(item.unitPrice, data.currency)} each
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="text-gray-400">Requested</div>
                      <div className="mt-1 font-semibold">{item.quantityRequested}</div>
                    </div>
                    <div className="text-xs">
                      <div className="text-gray-400">Received</div>
                      <div className="mt-1 font-semibold">{item.quantityReceived}</div>
                    </div>
                    <div className="text-xs">
                      <div className="text-gray-400">Restocked</div>
                      <div className="mt-1 font-semibold">{item.quantityRestocked}</div>
                    </div>
                  </div>

                  {data.status === "approved" && state && (
                    <div className="mt-4 grid gap-3 rounded-xl bg-[#fafbf9] p-4 md:grid-cols-3">
                      <input
                        type="number"
                        min="0"
                        max={item.quantityRequested}
                        step="1"
                        value={state.quantityReceived}
                        onChange={(event) =>
                          setInspection((current) => ({
                            ...current,
                            [item.orderItemId]: {
                              ...current[item.orderItemId],
                              quantityReceived: event.target.value,
                            },
                          }))
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                        aria-label={`Received quantity for ${item.productName}`}
                      />
                      <select
                        value={state.condition}
                        onChange={(event) =>
                          setInspection((current) => ({
                            ...current,
                            [item.orderItemId]: {
                              ...current[item.orderItemId],
                              condition: event.target.value as InspectionState["condition"],
                            },
                          }))
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                      >
                        <option value="new">New</option>
                        <option value="opened">Opened</option>
                        <option value="damaged">Damaged</option>
                        <option value="faulty">Faulty</option>
                      </select>
                      <select
                        value={state.restockDecision}
                        onChange={(event) =>
                          setInspection((current) => ({
                            ...current,
                            [item.orderItemId]: {
                              ...current[item.orderItemId],
                              restockDecision:
                                event.target.value as InspectionState["restockDecision"],
                            },
                          }))
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                      >
                        <option value="restock">Restock</option>
                        <option value="do_not_restock">Do not restock</option>
                      </select>
                    </div>
                  )}

                  {data.status !== "approved" && item.condition !== "pending_inspection" && (
                    <div className="mt-3 text-xs text-gray-500">
                      Condition: {item.condition.replaceAll("_", " ")} ·{" "}
                      {item.restockDecision.replaceAll("_", " ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {data.status === "approved" && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <label className="text-xs font-medium text-gray-500">
              Inspection note
            </label>
            <textarea
              value={inspectionNote}
              onChange={(event) => setInspectionNote(event.target.value)}
              rows={3}
              placeholder="Condition, packaging and restock observations"
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-5">
          {data.status === "requested" && (
            <>
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => void act("approve")}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                Approve return
              </button>
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => void act("reject")}
                className="rounded-lg border border-red-100 px-4 py-2 text-xs font-semibold text-red-600 disabled:opacity-40"
              >
                Reject
              </button>
            </>
          )}

          {data.status === "approved" && (
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => void act("receive")}
              className="rounded-lg bg-[#17251e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Receive & inspect
            </button>
          )}

          {["approved", "received"].includes(data.status) &&
            data.refundStatus === "pending_provider" && (
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => void act("reconcile_refund")}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
              >
                Reconcile provider refund
              </button>
            )}

          {canComplete && (
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => void act("complete")}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Complete return
            </button>
          )}

          {["requested", "approved"].includes(data.status) && (
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => void act("cancel")}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 disabled:opacity-40"
            >
              Cancel return
            </button>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
          Refund execution still happens through the payment provider workflow.
          This page only reconciles a refund after the order payment status has changed
          to partially refunded or refunded.
        </div>
      </section>
    </main>
  );
}
