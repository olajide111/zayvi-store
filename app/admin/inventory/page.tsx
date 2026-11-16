"use client";

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
  quantity: number | null;
  inventoryManaged: boolean;
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

  useEffect(() => {
    setLoading(true);
    setError("");

    fetch(`/api/admin/inventory?market=${market}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Unable to load inventory.");
        return payload;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load inventory."))
      .finally(() => setLoading(false));
  }, [market]);

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
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Inventory</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Inventory</h1>
          </div>
          <a href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">Back to overview</a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-800">Inventory readiness by market</div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-700">
                This uses the real PostgreSQL catalogue, pricing, publication and availability state.
                Quantity-level stock tracking will be added when own-stock and supplier feeds are connected.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-amber-200 bg-white p-1">
              {(["GB", "NG"] as const).map((code) => (
                <button
                  key={code}
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

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Catalogue items</div><div className="mt-2 text-3xl font-semibold">{data?.total ?? "—"}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Available</div><div className="mt-2 text-3xl font-semibold">{available}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Published</div><div className="mt-2 text-3xl font-semibold">{published}</div></div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by product or SKU" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]" />
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading inventory...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[1fr_120px] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 md:grid-cols-[minmax(0,1fr)_145px_120px_120px_120px_130px]">
              <span>Product</span>
              <span className="hidden md:block">SKU</span>
              <span className="hidden md:block">Availability</span>
              <span className="hidden md:block">Publication</span>
              <span className="hidden md:block">Price</span>
              <span>Quantity</span>
            </div>
            {visible.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_120px] items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_145px_120px_120px_120px_130px]">
                <div className="flex min-w-0 items-center gap-4">
                  <img src={item.image} alt="" className="h-12 w-12 rounded-xl border border-gray-100 object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{item.name}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {item.status} · {item.complianceStatus.replaceAll("_", " ")}
                      {item.requiresHumanApproval ? " · approval required" : ""}
                    </div>
                  </div>
                </div>
                <div className="hidden text-xs text-gray-500 md:block">{item.sku}</div>
                <div className="hidden text-xs capitalize text-gray-600 md:block">{item.availabilityStatus.replaceAll("_", " ")}</div>
                <div className="hidden text-xs capitalize text-gray-600 md:block">{item.publicationStatus.replaceAll("_", " ")}</div>
                <div className="hidden text-xs font-medium text-gray-700 md:block">{formatMoney(item.price, item.currency)}</div>
                <div className="text-sm font-medium text-gray-500">{item.inventoryManaged ? item.quantity ?? "—" : "Not tracked"}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
