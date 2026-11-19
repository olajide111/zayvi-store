"use client";

import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  image: string;
  status: string;
  marketCode: string;
  availabilityStatus: string;
  publicationStatus: string;
  complianceStatus: string;
  requiresHumanApproval: boolean;
  inventoryManaged: boolean;
  inventoryLevelId: string | null;
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
  onHand: number | null;
  reserved: number;
  safetyStock: number;
  availableToSell: number | null;
  price: number | null;
  currency: string;
};

type InventoryResponse = {
  source: string;
  marketCode: string;
  total: number;
  inventoryTrackingEnabled: boolean;
  items: InventoryItem[];
};

export default function AdminInventoryPage() {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<"GB" | "NG">("GB");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [notice, setNotice] = useState("");

  async function loadInventory() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/inventory?market=${market}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load inventory.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInventory();
  }, [market]);

  async function adjustStock(
    item: InventoryItem,
    quantityDelta: number,
    safetyStock?: number
  ) {
    setWorkingId(item.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: item.id,
          marketCode: market,
          quantityDelta,
          ...(safetyStock === undefined ? {} : { safetyStock }),
          note: "Manual Admin stock adjustment",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to adjust stock.");
      }

      setNotice(`${item.name} stock updated.`);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to adjust stock.");
    } finally {
      setWorkingId("");
    }
  }

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.items ?? []).filter((item) =>
      !normalized ||
      item.name.toLowerCase().includes(normalized) ||
      item.sku.toLowerCase().includes(normalized)
    );
  }, [data, query]);

  const available = data?.items.filter((item) => item.availabilityStatus === "available").length ?? 0;
  const published = data?.items.filter((item) => item.publicationStatus === "published").length ?? 0;

  const formatMoney = (value: number | null, currency: string) => {
    if (value === null) return "No price";
    return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "NGN" ? 0 : 2,
    }).format(value);
  };

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <AdminPageHeading section="Catalogue" title="Inventory" description="Check available stock and adjust quantities by market.">
        <Link href="/admin/replenishment" prefetch={false} className={adminAction}>Replenishment</Link>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        <div className="rounded-xl border border-[#dfe6e1] bg-white p-3 sm:p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#215241]">Stock by market</p>
              <p className="mt-1 text-xs text-[#52635b]">Available to sell accounts for reservations and safety stock.</p>
            </div>
            <div role="group" aria-label="Inventory market" className="inline-flex self-start rounded-lg border border-[#dfe6e1] bg-white p-1">
              {(["GB", "NG"] as const).map((code) => (
                <button
                  key={code}
                  aria-pressed={market === code}
                  onClick={() => setMarket(code)}
                  className={
                    "rounded-lg px-4 py-2 text-xs font-semibold " +
                    (market === code
                      ? "bg-[#17251e] text-white"
                      : "text-gray-600 hover:bg-gray-50")
                  }
                >
                  {code === "GB" ? "UK · GBP" : "Nigeria · NGN"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-[#52635b]">Catalogue items</div><div className="mt-1.5 text-2xl font-semibold tabular-nums">{data?.total ?? "—"}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-[#52635b]">Catalogue available</div><div className="mt-1.5 text-2xl font-semibold tabular-nums">{available}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-[#52635b]">Published</div><div className="mt-1.5 text-2xl font-semibold tabular-nums">{published}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-[#52635b]">Tracked</div><div className="mt-1.5 text-2xl font-semibold tabular-nums">{data?.items.filter((item) => item.inventoryManaged).length ?? 0}</div></div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search inventory" placeholder="Search by product or SKU" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]" />
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading inventory...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="hidden border-b xl:grid border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 xl:grid-cols-[minmax(0,1fr)_100px_62px_64px_56px_62px_132px]">
              <span>Product</span>
              <span className="hidden xl:block">SKU</span>
              <span className="hidden xl:block">On hand</span>
              <span className="hidden xl:block">Reserved</span>
              <span className="hidden xl:block">Safety</span>
              <span className="hidden xl:block">Available</span>
              <span>Adjust</span>
            </div>
            {visible.map((item) => (
              <div key={item.id} className="grid grid-cols-1 items-center gap-3 border-b border-gray-100 px-3 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5 last:border-b-0 xl:grid-cols-[minmax(0,1fr)_100px_62px_64px_56px_62px_132px]">
                <div className="flex min-w-0 items-center gap-4">
                  <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-gray-100 object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{item.name}</div>
                    <div className="mt-1 text-xs text-[#52635b]">
                      {item.status} · {item.publicationStatus.replaceAll("_", " ")} · {formatMoney(item.price, item.currency)}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      {item.locationName || (market === "GB" ? "UK own stock" : "Nigeria own stock")}
                    </div>
                    <p className="mt-1 text-xs font-medium text-[#215241] xl:hidden">
                      {item.availableToSell == null ? "Stock not tracked" : `${item.availableToSell} available · ${item.reserved} reserved`}
                    </p>
                  </div>
                </div>
                <div className="hidden text-xs text-gray-500 xl:block">{item.sku}</div>
                <div className="hidden text-sm font-semibold text-gray-800 xl:block">{item.onHand ?? "—"}</div>
                <div className="hidden text-sm text-gray-600 xl:block">{item.reserved}</div>
                <div className="hidden text-sm text-gray-600 xl:block">{item.safetyStock}</div>
                <div className="hidden text-sm font-semibold text-[#31543b] xl:block">{item.availableToSell ?? "—"}</div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={workingId === item.id}
                    onClick={() => void adjustStock(item, -1)}
                    className="h-9 w-9 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 disabled:opacity-40"
                    aria-label={`Remove one ${item.name}`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={workingId === item.id}
                    onClick={() => void adjustStock(item, 1)}
                    className="h-9 w-9 rounded-lg bg-[#17251e] text-sm font-semibold text-white disabled:opacity-40"
                    aria-label={`Add one ${item.name}`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={workingId === item.id}
                    onClick={() => {
                      const raw = window.prompt(
                        `Set safety stock for ${item.name}`,
                        String(item.safetyStock)
                      );
                      if (raw === null) return;
                      const next = Number(raw);
                      if (!Number.isSafeInteger(next) || next < 0) {
                        setError("Safety stock must be a non-negative whole number.");
                        return;
                      }
                      void adjustStock(item, 0, next);
                    }}
                    className="rounded-lg border border-gray-200 px-2.5 py-2 text-[10px] font-semibold text-gray-600 disabled:opacity-40"
                  >
                    Safety
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
