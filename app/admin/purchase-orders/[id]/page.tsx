"use client";

import { use, useEffect, useState } from "react";

type PurchaseOrderItem = {
  id: string;
  supplierOfferId: string;
  tenantProductId: string;
  supplierSku?: string | null;
  productName: string;
  canonicalCode: string;
  quantity: number;
  unitCost: number;
  currency: string;
  receivedQuantity: number;
  stockStatus: string;
  externalStockQuantity: number | null;
  leadTimeDays: number | null;
};

type SupplierEvent = {
  id: string;
  eventType: string;
  supplierReference?: string | null;
  note?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  shippedAt?: string | null;
  expectedDeliveryAt?: string | null;
  supplierUserEmail?: string | null;
  supplierUserName?: string | null;
  createdAt: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  verificationStatus: string;
  marketCode: string;
  currency: string;
  status: string;
  notes?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  submittedAt?: string | null;
  cancelledAt?: string | null;
  supplierAckStatus: string;
  supplierAcknowledgedAt?: string | null;
  supplierReference?: string | null;
  supplierUpdateNote?: string | null;
  latestCarrier?: string | null;
  latestTrackingNumber?: string | null;
  latestShippedAt?: string | null;
  expectedDeliveryAt?: string | null;
  supplierEvents: SupplierEvent[];
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(value);
}

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [workingItem, setWorkingItem] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/purchase-orders/${id}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load purchase order.");
      }

      setPo(payload.purchaseOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load purchase order.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function poAction(action: "approve" | "submitted") {
    setWorking(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/purchase-orders/${id}/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update purchase order.");
      }

      setNotice(
        action === "approve"
          ? "Purchase order approved."
          : "Purchase order marked submitted. This records an external action already taken."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update purchase order.");
    } finally {
      setWorking(false);
    }
  }

  async function receiveItem(item: PurchaseOrderItem) {
    const remaining = item.quantity - item.receivedQuantity;
    const raw = window.prompt(
      `Receive quantity for ${item.productName} (remaining ${remaining})`,
      String(remaining)
    );

    if (raw === null) return;
    const quantity = Number(raw);

    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > remaining) {
      setError(`Received quantity must be a whole number between 1 and ${remaining}.`);
      return;
    }

    setWorkingItem(item.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/purchase-orders/${id}/items/${item.id}/receive`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ quantity }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to receive stock.");
      }

      setNotice(`${quantity} unit(s) received into owned inventory.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to receive stock.");
    } finally {
      setWorkingItem("");
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7f8f6] p-10 text-sm text-gray-500">Loading purchase order...</main>;
  }

  if (!po) {
    return <main className="min-h-screen bg-[#f7f8f6] p-10 text-sm text-red-700">{error || "Purchase order not found."}</main>;
  }

  const total = po.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <a href="/admin/purchase-orders" className="text-xs text-gray-400 hover:text-gray-600">← Purchase orders</a>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">{po.poNumber}</h1>
            <div className="mt-1 text-xs text-gray-400">
              {po.supplierName} · {po.marketCode} · {po.currency}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs capitalize text-gray-500">{po.status.replaceAll("_", " ")}</div>
            <div className="mt-1 text-sm font-semibold">{money(total, po.currency)}</div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">Manual supplier submission</div>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            Zayvi does not send this PO to the supplier. Approve it here, send it externally yourself,
            then use “Mark submitted” to record that the external action happened.
          </p>
        </div>

        {notice && <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
        {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Supplier response</h2>
              <p className="mt-1 text-xs text-gray-400">
                Supplier-reported evidence only. These updates do not approve, cancel or receive this PO.
              </p>
            </div>
            <span
              className={
                "rounded-full px-3 py-1 text-xs font-semibold capitalize " +
                (po.supplierAckStatus === "acknowledged"
                  ? "bg-emerald-50 text-emerald-700"
                  : po.supplierAckStatus === "unable_to_fulfil"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700")
              }
            >
              {(po.supplierAckStatus || "pending").replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-4 grid gap-4 text-xs sm:grid-cols-4">
            <div>
              <div className="text-gray-400">Supplier reference</div>
              <div className="mt-1 font-semibold">{po.supplierReference || "—"}</div>
            </div>
            <div>
              <div className="text-gray-400">Carrier</div>
              <div className="mt-1 font-semibold">{po.latestCarrier || "—"}</div>
            </div>
            <div>
              <div className="text-gray-400">Tracking</div>
              <div className="mt-1 font-semibold break-all">
                {po.latestTrackingNumber || "—"}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Expected delivery</div>
              <div className="mt-1 font-semibold">
                {po.expectedDeliveryAt
                  ? new Date(po.expectedDeliveryAt).toLocaleDateString("en-GB")
                  : "—"}
              </div>
            </div>
          </div>

          {po.supplierUpdateNote && (
            <div className="mt-4 rounded-xl bg-[#fafbf9] p-3 text-xs leading-5 text-gray-600">
              {po.supplierUpdateNote}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Supplier status</div>
            <div className="mt-2 text-sm font-semibold capitalize">{po.verificationStatus.replaceAll("_", " ")}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">PO status</div>
            <div className="mt-2 text-sm font-semibold capitalize">{po.status.replaceAll("_", " ")}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Lines</div>
            <div className="mt-2 text-2xl font-semibold">{po.items.length}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Total</div>
            <div className="mt-2 text-lg font-semibold">{money(total, po.currency)}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {po.status === "draft" && (
            <button
              type="button"
              disabled={working}
              onClick={() => void poAction("approve")}
              className="rounded-xl bg-[#17251e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Approve PO
            </button>
          )}

          {po.status === "approved" && (
            <button
              type="button"
              disabled={working}
              onClick={() => void poAction("submitted")}
              className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Mark submitted
            </button>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Purchase-order lines</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {po.items.map((item) => {
              const remaining = item.quantity - item.receivedQuantity;
              return (
                <div key={item.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_120px_100px_120px_150px] lg:items-center">
                  <div>
                    <div className="text-sm font-semibold">{item.productName}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {item.supplierSku || item.canonicalCode}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      Supplier stock: {item.stockStatus.replaceAll("_", " ")} · Lead: {item.leadTimeDays === null ? "unknown" : item.leadTimeDays + "d"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Unit cost</div>
                    <div className="mt-1 text-sm font-semibold">{money(item.unitCost, item.currency)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Ordered</div>
                    <div className="mt-1 text-sm font-semibold">{item.quantity}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Received</div>
                    <div className="mt-1 text-sm font-semibold">{item.receivedQuantity}</div>
                  </div>
                  <div className="text-right">
                    {remaining > 0 && ["approved","submitted","partially_received"].includes(po.status) ? (
                      <button
                        type="button"
                        disabled={workingItem === item.id}
                        onClick={() => void receiveItem(item)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 disabled:opacity-40"
                      >
                        Receive stock
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {remaining === 0 ? "Fully received" : "Not receivable yet"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Supplier event history</h2>
          </div>

          {po.supplierEvents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No supplier acknowledgements or shipment updates yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {po.supplierEvents.map((event) => (
                <div key={event.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold capitalize">
                        {event.eventType.replaceAll("_", " ")}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {event.supplierUserName || event.supplierUserEmail || "Supplier user"}
                        {" · "}
                        {new Date(event.createdAt).toLocaleString("en-GB")}
                      </div>
                    </div>
                    {event.supplierReference && (
                      <div className="text-xs text-gray-500">
                        Ref: {event.supplierReference}
                      </div>
                    )}
                  </div>
                  {(event.carrier || event.trackingNumber) && (
                    <div className="mt-2 text-xs text-gray-600">
                      {[event.carrier, event.trackingNumber].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {event.note && (
                    <div className="mt-2 text-xs leading-5 text-gray-500">
                      {event.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {po.notes && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs font-semibold text-gray-500">Notes</div>
            <div className="mt-2 text-sm leading-6 text-gray-700">{po.notes}</div>
          </div>
        )}
      </section>
    </main>
  );
}
