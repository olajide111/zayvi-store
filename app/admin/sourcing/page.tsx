"use client";

import Link from "next/link";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

import { useEffect, useMemo, useState } from "react";

type SourceOption = {
  sourceType: "own_stock" | "supplier";
  sourceId: string;
  supplierId?: string;
  sourceName: string;
  supplierType?: string;
  fulfilmentModel?: string;
  supplierSku?: string | null;
  eligible: boolean;
  score: number | null;
  reasons: string[];
  availableQuantity: number | null;
  unitCost: number | null;
  marginAmount: number | null;
  marginPercent: number | null;
  minimumOrderQuantity?: number;
  leadTimeDays: number | null;
  verificationStatus: string;
  stockStatus: string;
  sourceUpdatedAt?: string | null;
};

type ProductRecommendation = {
  tenantProductId: string;
  productId: string;
  productName: string;
  canonicalCode: string;
  marketCode: "GB" | "NG";
  currency: string;
  sellingPrice: number | null;
  publicationStatus: string;
  availabilityStatus: string;
  recommendedSourceId: string | null;
  recommendedSourceType: string | null;
  recommendedSourceName: string | null;
  sources: SourceOption[];
};

type SourcingResponse = {
  source: string;
  marketCode: "GB" | "NG";
  generatedAt: string;
  routingEnabled: boolean;
  methodology: string;
  recommendations: ProductRecommendation[];
};

function money(value: number | null, currency: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(value);
}

function SourceCard({
  source,
  currency,
  recommended,
}: {
  source: SourceOption;
  currency: string;
  recommended: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border p-4 " +
        (recommended
          ? "border-emerald-200 bg-emerald-50/60"
          : source.eligible
            ? "border-gray-200 bg-white"
            : "border-gray-100 bg-gray-50/60")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{source.sourceName}</div>
          <div className="mt-1 text-[11px] capitalize text-gray-400">
            {source.sourceType === "own_stock"
              ? "Owned inventory"
              : (source.supplierType || "supplier").replaceAll("_", " ")}
          </div>
        </div>
        <div className="text-right">
          {recommended && (
            <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              Recommended
            </div>
          )}
          {!recommended && source.score !== null && (
            <div className="text-xs font-semibold text-gray-500">
              Score {source.score}
            </div>
          )}
          {!source.eligible && (
            <div className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-500">
              Not eligible
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-gray-400">Available</div>
          <div className="mt-1 font-semibold">
            {source.availableQuantity ?? "Unknown"}
          </div>
        </div>
        <div>
          <div className="text-gray-400">Stock state</div>
          <div className="mt-1 font-semibold capitalize">
            {source.stockStatus.replaceAll("_", " ")}
          </div>
        </div>
        <div>
          <div className="text-gray-400">Unit cost</div>
          <div className="mt-1 font-semibold">
            {source.sourceType === "own_stock"
              ? "Internal"
              : money(source.unitCost, currency)}
          </div>
        </div>
        <div>
          <div className="text-gray-400">Gross margin</div>
          <div className="mt-1 font-semibold">
            {source.marginPercent === null
              ? "—"
              : source.marginPercent.toFixed(1) + "%"}
          </div>
        </div>
        <div>
          <div className="text-gray-400">Lead time</div>
          <div className="mt-1 font-semibold">
            {source.leadTimeDays === null
              ? "Unknown"
              : source.leadTimeDays + " day(s)"}
          </div>
        </div>
        <div>
          <div className="text-gray-400">Verification</div>
          <div className="mt-1 font-semibold capitalize">
            {source.verificationStatus.replaceAll("_", " ")}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-black/5 pt-3">
        {source.reasons.map((reason, index) => (
          <div key={index} className="text-[11px] leading-4 text-gray-500">
            • {reason}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminSourcingPage() {
  const [market, setMarket] = useState<"GB" | "NG">("GB");
  const [data, setData] = useState<SourcingResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/admin/sourcing?market=" + encodeURIComponent(market),
          { credentials: "include", cache: "no-store" }
        );

        if (response.status === 401) {
          window.location.href = "/admin";
          return;
        }

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload?.error || "Unable to load sourcing recommendations."
          );
        }

        setData(payload);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load sourcing recommendations."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [market]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (data?.recommendations ?? []).filter(
      (item) =>
        !normalized ||
        item.productName.toLowerCase().includes(normalized) ||
        item.canonicalCode.toLowerCase().includes(normalized)
    );
  }, [data, query]);

  const withRecommendation =
    data?.recommendations.filter((item) => item.recommendedSourceId).length ?? 0;
  const blocked =
    data?.recommendations.filter((item) => !item.recommendedSourceId).length ?? 0;
  const supplierRecommended =
    data?.recommendations.filter(
      (item) => item.recommendedSourceType === "supplier"
    ).length ?? 0;

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <AdminPageHeading section="Insights" title="Sourcing intelligence" description="Compare supplier offers and stock options by market.">
        <Link href="/admin/suppliers" prefetch={false} className={adminAction}>Suppliers</Link>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-blue-800">
                Explainable sourcing recommendations
              </div>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
                {data?.methodology ||
                  "Recommendations compare owned stock with supplier evidence. Automatic fulfilment routing is disabled."}
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-blue-200 bg-white p-1">
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
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Source recommended</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">{withRecommendation}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Supplier recommended</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">{supplierRecommended}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Blocked / insufficient evidence</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">{blocked}</div>
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
            Calculating sourcing recommendations...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6 space-y-5">
            {visible.map((product) => (
              <section
                key={product.tenantProductId}
                className="rounded-2xl border border-gray-200 bg-white p-5"
              >
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold">{product.productName}</h2>
                    <div className="mt-1 text-xs text-[#52635b]">
                      {product.canonicalCode} · {product.marketCode} ·{" "}
                      {product.publicationStatus.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-xs text-[#52635b]">Selling price</div>
                    <div className="mt-1 text-lg font-semibold">
                      {money(product.sellingPrice, product.currency)}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      {product.recommendedSourceName
                        ? "Recommended: " + product.recommendedSourceName
                        : "No eligible source"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {product.sources.length > 0 ? (
                    product.sources.map((source) => (
                      <SourceCard
                        key={source.sourceId}
                        source={source}
                        currency={product.currency}
                        recommended={
                          product.recommendedSourceId === source.sourceId
                        }
                      />
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-500">
                      No owned inventory or supplier offer has been recorded for
                      this product.
                    </div>
                  )}
                </div>
              </section>
            ))}

            {visible.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                No sourcing records match this view.
              </div>
            )}
          </div>
        )}

        {data && (
          <div className="mt-5 flex flex-col gap-1 text-[11px] text-gray-400 md:flex-row md:justify-between">
            <span>
              Automatic routing: {data.routingEnabled ? "enabled" : "disabled"}
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
