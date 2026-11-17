"use client";

import Link from "next/link";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

import { useEffect, useMemo, useState } from "react";

type SupplierPerformance = {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  marketCode: string;
  supplierType: string;
  fulfilmentModel: string;
  status: string;
  verificationStatus: string;
  activeOffers: number;
  feed: {
    batchCount: number;
    acceptedItems: number;
    rejectedItems: number;
    acceptanceRate: number | null;
    lastFeedAt?: string | null;
  };
  inventorySync: {
    runCount: number;
    matchedItems: number;
    unmatchedItems: number;
    staleItems: number;
    matchRate: number | null;
    lastSyncAt?: string | null;
  };
  purchaseOrders: {
    count: number;
    submittedCount: number;
    acknowledgedCount: number;
    unableToFulfilCount: number;
    pendingAcknowledgementCount: number;
    averageAcknowledgementHours: number | null;
    orderedUnits: number;
    receivedUnits: number;
    receiptRate: number | null;
    lastShippedAt?: string | null;
  };
  attentionFlags: string[];
};

type ResponsePayload = {
  generatedAt: string;
  total: number;
  suppliers: SupplierPerformance[];
};

function percent(value: number | null) {
  return value === null ? "—" : Math.round(value * 100) + "%";
}

function hours(value: number | null) {
  if (value === null) return "—";
  if (value < 24) return value.toFixed(1) + "h";
  return (value / 24).toFixed(1) + "d";
}

function flagLabel(flag: string) {
  return flag.replaceAll("_", " ");
}

export default function SupplierPerformancePage() {
  const [data, setData] = useState<ResponsePayload | null>(null);
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/supplier-performance", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload?.error || "Unable to load supplier performance."
          );
        }

        return payload as ResponsePayload;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load supplier performance."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (data?.suppliers ?? []).filter((supplier) => {
      const matchesQuery =
        !term ||
        supplier.supplierName.toLowerCase().includes(term) ||
        supplier.supplierCode.toLowerCase().includes(term);

      const matchesMarket =
        market === "all" || supplier.marketCode === market;

      const matchesAttention =
        !attentionOnly || supplier.attentionFlags.length > 0;

      return matchesQuery && matchesMarket && matchesAttention;
    });
  }, [data, query, market, attentionOnly]);

  const attentionCount =
    data?.suppliers.filter((supplier) => supplier.attentionFlags.length > 0)
      .length ?? 0;

  const pendingAcks =
    data?.suppliers.reduce(
      (sum, supplier) =>
        sum + supplier.purchaseOrders.pendingAcknowledgementCount,
      0
    ) ?? 0;

  const unmatchedSkus =
    data?.suppliers.reduce(
      (sum, supplier) => sum + supplier.inventorySync.unmatchedItems,
      0
    ) ?? 0;

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <AdminPageHeading section="Insights" title="Supplier performance" description="Review supplier activity, order acknowledgement and stock evidence.">
        <Link href="/admin/suppliers" prefetch={false} className={adminAction}>Suppliers</Link>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">
            Evidence-based metrics
          </div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            This workspace uses recorded feed, inventory-sync and purchase-order
            events. It does not generate an opaque supplier score. Attention flags
            are simple operational rules so you can inspect the underlying numbers.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Suppliers</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">
              {data?.total ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Need attention</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">
              {attentionCount}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">
              Pending PO acknowledgements / unmatched SKUs
            </div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">
              {pendingAcks} / {unmatchedSkus}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search supplier"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />
          <select
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">All markets</option>
            <option value="GB">United Kingdom</option>
            <option value="NG">Nigeria</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(event) => setAttentionOnly(event.target.checked)}
            />
            Attention only
          </label>
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading supplier performance...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <h2 className="text-base font-semibold">No matching suppliers</h2>
            <p className="mt-2 text-sm text-gray-500">
              Change the filters or add supplier operational history first.
            </p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="mt-6 space-y-4">
            {visible.map((supplier) => (
              <section
                key={supplier.supplierId}
                className="rounded-2xl border border-gray-200 bg-white p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <a
                      href={`/admin/suppliers/${supplier.supplierId}`}
                      className="text-base font-semibold text-[#23432d] hover:underline"
                    >
                      {supplier.supplierName}
                    </a>
                    <div className="mt-1 text-xs text-[#52635b]">
                      {supplier.supplierCode} · {supplier.marketCode} ·{" "}
                      {supplier.supplierType.replaceAll("_", " ")} ·{" "}
                      {supplier.fulfilmentModel.replaceAll("_", " ")}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize " +
                        (supplier.verificationStatus === "verified"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700")
                      }
                    >
                      {supplier.verificationStatus.replaceAll("_", " ")}
                    </span>
                    {supplier.attentionFlags.length === 0 && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                        no current flags
                      </span>
                    )}
                  </div>
                </div>

                {supplier.attentionFlags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {supplier.attentionFlags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-amber-700"
                      >
                        {flagLabel(flag)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl bg-[#fafbf9] p-4">
                    <div className="text-xs font-semibold">Feed quality</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-400">Acceptance</div>
                        <div className="mt-1 text-lg font-semibold">
                          {percent(supplier.feed.acceptanceRate)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Batches</div>
                        <div className="mt-1 text-lg font-semibold">
                          {supplier.feed.batchCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Accepted</div>
                        <div className="mt-1 font-semibold">
                          {supplier.feed.acceptedItems}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Rejected</div>
                        <div className="mt-1 font-semibold">
                          {supplier.feed.rejectedItems}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#fafbf9] p-4">
                    <div className="text-xs font-semibold">Inventory sync</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-400">Match rate</div>
                        <div className="mt-1 text-lg font-semibold">
                          {percent(supplier.inventorySync.matchRate)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Sync runs</div>
                        <div className="mt-1 text-lg font-semibold">
                          {supplier.inventorySync.runCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Unmatched</div>
                        <div className="mt-1 font-semibold">
                          {supplier.inventorySync.unmatchedItems}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Stale ignored</div>
                        <div className="mt-1 font-semibold">
                          {supplier.inventorySync.staleItems}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#fafbf9] p-4">
                    <div className="text-xs font-semibold">Purchase orders</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-400">Receipt rate</div>
                        <div className="mt-1 text-lg font-semibold">
                          {percent(supplier.purchaseOrders.receiptRate)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Avg acknowledgement</div>
                        <div className="mt-1 text-lg font-semibold">
                          {hours(
                            supplier.purchaseOrders
                              .averageAcknowledgementHours
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Pending ack</div>
                        <div className="mt-1 font-semibold">
                          {
                            supplier.purchaseOrders
                              .pendingAcknowledgementCount
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Unable to fulfil</div>
                        <div className="mt-1 font-semibold">
                          {supplier.purchaseOrders.unableToFulfilCount}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-gray-400">
                  <span>{supplier.activeOffers} active offer(s)</span>
                  <span>
                    PO units {supplier.purchaseOrders.receivedUnits}/
                    {supplier.purchaseOrders.orderedUnits} received
                  </span>
                  <span>
                    Feed last seen{" "}
                    {supplier.feed.lastFeedAt
                      ? new Date(supplier.feed.lastFeedAt).toLocaleString("en-GB")
                      : "never"}
                  </span>
                  <span>
                    Stock sync last seen{" "}
                    {supplier.inventorySync.lastSyncAt
                      ? new Date(
                          supplier.inventorySync.lastSyncAt
                        ).toLocaleString("en-GB")
                      : "never"}
                  </span>
                </div>
              </section>
            ))}
          </div>
        )}

        {data?.generatedAt && (
          <div className="mt-4 text-right text-[11px] text-gray-400">
            Generated {new Date(data.generatedAt).toLocaleString("en-GB")}
          </div>
        )}
      </section>
    </main>
  );
}
