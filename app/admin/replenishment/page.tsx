"use client";

import { useEffect, useMemo, useState } from "react";

type FallbackSupplier = {
  supplierId: string;
  supplierName: string;
  supplierOfferId: string;
  supplierSku?: string | null;
  unitCost: number | null;
  leadTimeDays: number | null;
  stockStatus: string;
  externalStockQuantity: number | null;
  sourceUpdatedAt?: string | null;
};

type ReplenishmentItem = {
  tenantProductId: string;
  productId: string;
  productName: string;
  canonicalCode: string;
  image: string;
  marketCode: "GB" | "NG";
  currency: string;
  sellingPrice: number | null;
  publicationStatus: string;
  availabilityStatus: string;
  inventoryTracked: boolean;
  inventoryLevelId: string | null;
  locationName?: string | null;
  onHand: number | null;
  reserved: number;
  safetyStock: number;
  availableToSell: number | null;
  attentionReason:
    | "inventory_not_tracked"
    | "no_sellable_stock"
    | "at_safety_threshold";
  severity: "setup" | "critical" | "warning";
  inventoryUpdatedAt?: string | null;
  fallbackSupplier?: FallbackSupplier | null;
};

type ReplenishmentResponse = {
  source: string;
  marketCode: "GB" | "NG";
  generatedAt: string;
  autoReorderEnabled: boolean;
  total: number;
  items: ReplenishmentItem[];
};

function money(value: number | null, currency: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(value);
}

function reasonLabel(reason: ReplenishmentItem["attentionReason"]) {
  if (reason === "inventory_not_tracked") return "Inventory not tracked";
  if (reason === "no_sellable_stock") return "No sellable stock";
  return "At safety threshold";
}

export default function AdminReplenishmentPage() {
  const [market, setMarket] = useState<"GB" | "NG">("GB");
  const [data, setData] = useState<ReplenishmentResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/admin/replenishment?market=" + encodeURIComponent(market),
          { credentials: "include", cache: "no-store" }
        );

        if (response.status === 401) {
          window.location.href = "/admin";
          return;
        }

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load replenishment watchlist.");
        }

        setData(payload);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load replenishment watchlist."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [market]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (item) =>
        !normalized ||
        item.productName.toLowerCase().includes(normalized) ||
        item.canonicalCode.toLowerCase().includes(normalized)
    );
  }, [data, query]);

  const critical =
    data?.items.filter((item) => item.severity === "critical").length ?? 0;
  const warnings =
    data?.items.filter((item) => item.severity === "warning").length ?? 0;
  const setup =
    data?.items.filter((item) => item.severity === "setup").length ?? 0;

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Replenishment</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Replenishment watchlist
            </h1>
          </div>
          <a
            href="/admin/inventory"
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Back to inventory
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-800">
                Inventory attention only
              </div>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-amber-700">
                This view flags real stock gaps and shows the best verified supplier fallback when one exists.
                Zayvi does not invent reorder quantities and automatic purchasing is disabled.
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-amber-200 bg-white p-1">
              {(["GB", "NG"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setMarket(code)}
                  className={
                    "rounded-lg px-4 py-2 text-xs font-semibold " +
                    (market === code
                      ? "bg-[#17251e] text-white"
                      : "text-gray-600")
                  }
                >
                  {code === "GB" ? "UK · GBP" : "Nigeria · NGN"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-red-100 bg-white p-5">
            <div className="text-xs text-gray-400">No sellable stock</div>
            <div className="mt-2 text-3xl font-semibold">{critical}</div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-5">
            <div className="text-xs text-gray-400">At safety threshold</div>
            <div className="mt-2 text-3xl font-semibold">{warnings}</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-5">
            <div className="text-xs text-gray-400">Inventory setup needed</div>
            <div className="mt-2 text-3xl font-semibold">{setup}</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product or SKU"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
          />
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading replenishment watchlist...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="mt-6 space-y-4">
            {visible.map((item) => (
              <section
                key={item.tenantProductId}
                className="rounded-2xl border border-gray-200 bg-white p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <img
                      src={item.image}
                      alt=""
                      className="h-14 w-14 rounded-xl border border-gray-100 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {item.productName}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {item.canonicalCode} · {item.publicationStatus.replaceAll("_", " ")}
                      </div>
                      <div className="mt-2 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">
                        {reasonLabel(item.attentionReason)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <div className="text-gray-400">On hand</div>
                      <div className="mt-1 font-semibold">{item.onHand ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Reserved</div>
                      <div className="mt-1 font-semibold">{item.reserved}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Safety</div>
                      <div className="mt-1 font-semibold">{item.safetyStock}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Available</div>
                      <div className="mt-1 font-semibold">{item.availableToSell ?? "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-[#fafbf9] p-4">
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">
                      Current product economics
                    </div>
                    <div className="mt-2 text-sm font-semibold">
                      Selling price: {money(item.sellingPrice, item.currency)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Location: {item.locationName || "Not configured"}
                    </div>
                  </div>

                  <div
                    className={
                      "rounded-xl p-4 " +
                      (item.fallbackSupplier
                        ? "border border-emerald-100 bg-emerald-50"
                        : "border border-dashed border-gray-200 bg-white")
                    }
                  >
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">
                      Verified supplier fallback
                    </div>

                    {item.fallbackSupplier ? (
                      <>
                        <div className="mt-2 text-sm font-semibold">
                          {item.fallbackSupplier.supplierName}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <div className="text-gray-400">Unit cost</div>
                            <div className="mt-1 font-semibold">
                              {money(item.fallbackSupplier.unitCost, item.currency)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400">Lead</div>
                            <div className="mt-1 font-semibold">
                              {item.fallbackSupplier.leadTimeDays === null
                                ? "Unknown"
                                : item.fallbackSupplier.leadTimeDays + "d"}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400">Reported qty</div>
                            <div className="mt-1 font-semibold">
                              {item.fallbackSupplier.externalStockQuantity ?? "Unknown"}
                            </div>
                          </div>
                        </div>
                        <a
                          href={`/admin/suppliers/${item.fallbackSupplier.supplierId}`}
                          className="mt-3 inline-block text-[11px] font-semibold text-emerald-800 hover:underline"
                        >
                          Review supplier offer →
                        </a>
                      </>
                    ) : (
                      <div className="mt-2 text-sm text-gray-500">
                        No verified supplier fallback with available stock is recorded.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <h2 className="text-base font-semibold">No inventory attention items</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
              No tracked products in this market are currently below their configured stock controls.
            </p>
          </div>
        )}

        {data && (
          <div className="mt-5 flex flex-col gap-1 text-[11px] text-gray-400 md:flex-row md:justify-between">
            <span>
              Automatic reordering: {data.autoReorderEnabled ? "enabled" : "disabled"}
            </span>
            <span>
              Generated {new Date(data.generatedAt).toLocaleString("en-GB")}
            </span>
          </div>
        )}
      </section>
    </main>
  );
}
