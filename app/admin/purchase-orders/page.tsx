"use client";

import { useEffect, useState } from "react";

type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  marketCode: string;
  currency: string;
  status: string;
  notes?: string | null;
  lineCount: number;
  totalValue: number;
  receivedUnits: number;
  orderedUnits: number;
  approvedBy?: string | null;
  approvedAt?: string | null;
  submittedAt?: string | null;
  supplierAckStatus?: string;
  supplierAcknowledgedAt?: string | null;
  supplierReference?: string | null;
  latestCarrier?: string | null;
  latestTrackingNumber?: string | null;
  latestShippedAt?: string | null;
  expectedDeliveryAt?: string | null;
  createdAt: string;
};

type PurchaseOrdersResponse = {
  source: string;
  total: number;
  purchaseOrders: PurchaseOrder[];
  automaticSubmissionEnabled: boolean;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(value);
}

export default function PurchaseOrdersPage() {
  const [data, setData] = useState<PurchaseOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/purchase-orders", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Unable to load purchase orders.");
        return payload;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load purchase orders."))
      .finally(() => setLoading(false));
  }, []);

  const drafts = data?.purchaseOrders.filter((po) => po.status === "draft").length ?? 0;
  const open = data?.purchaseOrders.filter((po) => ["approved","submitted","partially_received"].includes(po.status)).length ?? 0;
  const received = data?.purchaseOrders.filter((po) => po.status === "received").length ?? 0;

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Purchase orders</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Purchase orders</h1>
          </div>
          <a href="/admin/replenishment" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">
            Replenishment
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">Human-controlled supplier purchasing</div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            Purchase orders are created and approved in Zayvi, but Zayvi does not automatically send them to suppliers.
            Mark “submitted” only after the order has been sent externally.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Drafts</div><div className="mt-2 text-3xl font-semibold">{drafts}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Open</div><div className="mt-2 text-3xl font-semibold">{open}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Received</div><div className="mt-2 text-3xl font-semibold">{received}</div></div>
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading purchase orders...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && data && data.purchaseOrders.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[1fr_110px] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 md:grid-cols-[145px_minmax(0,1fr)_100px_110px_120px_150px_120px]">
              <span>PO</span>
              <span className="hidden md:block">Supplier</span>
              <span className="hidden md:block">Market</span>
              <span className="hidden md:block">PO status</span>
              <span className="hidden md:block">Supplier</span>
              <span className="hidden md:block">Shipment</span>
              <span>Total</span>
            </div>
            {data.purchaseOrders.map((po) => (
              <div key={po.id} className="grid grid-cols-[1fr_110px] items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0 md:grid-cols-[145px_minmax(0,1fr)_100px_110px_120px_150px_120px]">
                <a href={`/admin/purchase-orders/${po.id}`} className="text-sm font-semibold text-[#23432d] hover:underline">{po.poNumber}</a>
                <div className="hidden truncate text-sm text-gray-700 md:block">{po.supplierName}</div>
                <div className="hidden text-xs text-gray-500 md:block">{po.marketCode}</div>
                <div className="hidden text-xs capitalize text-gray-600 md:block">{po.status.replaceAll("_", " ")}</div>
                <div className="hidden text-xs capitalize text-gray-600 md:block">
                  {(po.supplierAckStatus || "pending").replaceAll("_", " ")}
                </div>
                <div className="hidden text-xs text-gray-600 md:block">
                  {po.latestTrackingNumber || po.latestCarrier
                    ? [po.latestCarrier, po.latestTrackingNumber].filter(Boolean).join(" · ")
                    : "—"}
                </div>
                <div className="text-sm font-semibold">{money(po.totalValue, po.currency)}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && data && data.purchaseOrders.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <h2 className="text-base font-semibold">No purchase orders yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
              Create the first draft from a verified supplier fallback on the replenishment watchlist.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
