"use client";

import Link from "next/link";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

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
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("all");

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

  const purchaseOrders = data?.purchaseOrders ?? [];
  const term = filter.trim().toLowerCase();
  const visible = purchaseOrders.filter((po) =>
    (status === "all" || po.status === status) &&
    (!term || [po.poNumber, po.supplierName, po.marketCode].some((value) => value?.toLowerCase().includes(term))),
  );

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <AdminPageHeading section="Operations" title="Purchase orders" description="Review supplier purchases from draft through receipt.">
        <Link href="/admin/replenishment" prefetch={false} className={adminAction}>Replenishment</Link>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">Human-controlled supplier purchasing</div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            Purchase orders are created and approved in Zayvi, but Zayvi does not automatically send them to suppliers.
            Mark “submitted” only after the order has been sent externally.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-[#52635b]">Drafts</div><div className="mt-1.5 text-2xl font-semibold tabular-nums">{drafts}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-[#52635b]">Open</div><div className="mt-1.5 text-2xl font-semibold tabular-nums">{open}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-[#52635b]">Received</div><div className="mt-1.5 text-2xl font-semibold tabular-nums">{received}</div></div>
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading purchase orders...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && purchaseOrders.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 rounded-xl border border-[#dfe6e1] bg-white p-3">
            <input aria-label="Search purchase orders" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search number, supplier or market" className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#dfe6e1] px-3 text-sm" />
            <select aria-label="Purchase order status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm">
              <option value="all">All statuses</option>
              {[...new Set(purchaseOrders.map((po) => po.status))].sort().map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </div>
        )}

        {!loading && !error && data && visible.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 xl:grid-cols-[112px_minmax(0,1fr)_75px_85px_82px_110px_94px]">
              <span>PO</span>
              <span className="hidden xl:block">Supplier</span>
              <span className="hidden xl:block">Market</span>
              <span className="hidden xl:block">PO status</span>
              <span className="hidden xl:block">Supplier</span>
              <span className="hidden xl:block">Shipment</span>
              <span>Total</span>
            </div>
            {visible.map((po) => (
              <div key={po.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0 xl:grid-cols-[112px_minmax(0,1fr)_75px_85px_82px_110px_94px]">
                <div className="min-w-0">
                  <Link href={`/admin/purchase-orders/${encodeURIComponent(po.id)}`} prefetch={false} className="text-sm font-semibold break-words text-[#215241] hover:underline">{po.poNumber}</Link>
                  <p className="mt-1 text-xs break-words text-[#52635b] xl:hidden">{po.supplierName} · {po.marketCode} · {po.status.replaceAll("_", " ")}</p>
                </div>
                <div className="hidden truncate text-sm text-gray-700 xl:block">{po.supplierName}</div>
                <div className="hidden text-xs text-gray-500 xl:block">{po.marketCode}</div>
                <div className="hidden text-xs capitalize text-gray-600 xl:block">{po.status.replaceAll("_", " ")}</div>
                <div className="hidden text-xs capitalize text-gray-600 xl:block">
                  {(po.supplierAckStatus || "pending").replaceAll("_", " ")}
                </div>
                <div className="hidden text-xs text-gray-600 xl:block">
                  {po.latestTrackingNumber || po.latestCarrier
                    ? [po.latestCarrier, po.latestTrackingNumber].filter(Boolean).join(" · ")
                    : "—"}
                </div>
                <div className="text-sm font-semibold">{money(po.totalValue, po.currency)}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && purchaseOrders.length > 0 && visible.length === 0 && (
          <p className="mt-5 rounded-xl border border-[#dfe6e1] bg-white p-4 text-sm text-[#52635b]">No purchase orders match these filters.</p>
        )}

        {!loading && !error && data && purchaseOrders.length === 0 && (
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
