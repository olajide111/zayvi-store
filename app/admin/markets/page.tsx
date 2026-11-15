"use client";

import { useEffect, useMemo, useState } from "react";

type Market = {
  code: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  enabled: boolean;
  configurationVersion: number;
};

type MarketsResponse = {
  total: number;
  markets: Market[];
};

type ProductMarket = {
  id: string;
  name: string;
  category: string;
  image: string;
  price: number | null;
  currency: string | null;
  marketCode?: string | null;
  availabilityStatus:
    | "unknown"
    | "available"
    | "limited_stock"
    | "out_of_stock"
    | "unavailable"
    | "restricted";
  publicationStatus:
    | "not_listed"
    | "pending_review"
    | "published"
    | "held"
    | "rejected"
    | "withdrawn";
};

type ProductMarketResponse = {
  products?: ProductMarket[];
};

type DraftMarket = {
  price: string;
  availabilityStatus: ProductMarket["availabilityStatus"];
  publicationStatus: ProductMarket["publicationStatus"];
};

export default function AdminMarketsPage() {
  const [data, setData] = useState<MarketsResponse | null>(null);
  const [ngProducts, setNgProducts] = useState<ProductMarket[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftMarket>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [marketsResponse, nigeriaResponse] = await Promise.all([
        fetch("/api/admin/markets", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/admin/product-markets?market=NG", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (marketsResponse.status === 401 || nigeriaResponse.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const marketsPayload = await marketsResponse.json();
      const nigeriaPayload =
        (await nigeriaResponse.json()) as ProductMarketResponse & {
          error?: string;
        };

      if (!marketsResponse.ok) {
        throw new Error(marketsPayload?.error || "Unable to load markets.");
      }

      if (!nigeriaResponse.ok) {
        throw new Error(
          nigeriaPayload?.error || "Unable to load Nigeria pricing."
        );
      }

      const products = Array.isArray(nigeriaPayload.products)
        ? nigeriaPayload.products
        : [];

      setData(marketsPayload);
      setNgProducts(products);
      setDrafts(
        Object.fromEntries(
          products.map((product) => [
            product.id,
            {
              price:
                product.price === null || product.price === undefined
                  ? ""
                  : String(product.price),
              availabilityStatus: product.availabilityStatus || "unknown",
              publicationStatus: product.publicationStatus || "not_listed",
            },
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load markets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const nigeriaReadyCount = useMemo(
    () =>
      ngProducts.filter(
        (product) =>
          product.price !== null &&
          product.availabilityStatus === "available"
      ).length,
    [ngProducts]
  );

  function updateDraft(
    productId: string,
    field: keyof DraftMarket,
    value: string
  ) {
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] || {
          price: "",
          availabilityStatus: "unknown",
          publicationStatus: "not_listed",
        }),
        [field]: value,
      } as DraftMarket,
    }));
  }

  async function saveNigeriaProduct(product: ProductMarket) {
    const draft = drafts[product.id];
    if (!draft || savingId) return;

    setSavingId(product.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/product-markets", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          marketCode: "NG",
          price: draft.price === "" ? null : Number(draft.price),
          availabilityStatus: draft.availabilityStatus,
          publicationStatus: draft.publicationStatus,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to update Nigeria market pricing."
        );
      }

      setNotice(`${product.name} Nigeria pricing saved.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update Nigeria market pricing."
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Markets</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Markets & Currencies
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
        <div className="rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5">
          <div className="text-sm font-semibold text-[#23432d]">
            Explicit market pricing
          </div>
          <p className="mt-1 text-xs leading-5 text-[#55705b]">
            UK and Nigeria are separate commerce markets. Nigeria prices must
            be entered directly in NGN; Zayvi does not silently convert GBP
            prices.
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

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Markets configured</div>
            <div className="mt-2 text-3xl font-semibold">
              {data?.total ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Enabled</div>
            <div className="mt-2 text-3xl font-semibold">
              {data?.markets.filter((market) => market.enabled).length ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">
              Nigeria products ready
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {loading ? "—" : `${nigeriaReadyCount}/${ngProducts.length}`}
            </div>
          </div>
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading markets...
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {data?.markets.map((market) => (
                <div
                  key={market.code}
                  className="rounded-2xl border border-gray-200 bg-white p-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold tracking-[0.15em] text-gray-400">
                        {market.code}
                      </div>
                      <h2 className="mt-2 text-lg font-semibold">
                        {market.name}
                      </h2>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        market.enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {market.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="mt-6 space-y-3 border-t border-gray-100 pt-5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Currency</span>
                      <span className="font-semibold">{market.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Locale</span>
                      <span>{market.locale}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Timezone</span>
                      <span>{market.timezone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Config version</span>
                      <span>{market.configurationVersion}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 bg-[#fafbf9] px-5 py-4">
                <h2 className="text-sm font-semibold">
                  Nigeria catalogue pricing · NGN
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  A product cannot be marked available without an explicit NGN
                  price. Kredal checkout remains disabled separately.
                </p>
              </div>

              <div className="divide-y divide-gray-100">
                {ngProducts.map((product) => {
                  const draft = drafts[product.id];
                  if (!draft) return null;

                  return (
                    <div
                      key={product.id}
                      className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto] lg:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt=""
                            className="h-12 w-12 rounded-xl border border-gray-100 object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-gray-100" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {product.name}
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            {product.category}
                          </div>
                        </div>
                      </div>

                      <label className="text-xs text-gray-500">
                        NGN price
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={draft.price}
                          onChange={(event) =>
                            updateDraft(
                              product.id,
                              "price",
                              event.target.value
                            )
                          }
                          placeholder="e.g. 45000"
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800"
                        />
                      </label>

                      <label className="text-xs text-gray-500">
                        Availability
                        <select
                          value={draft.availabilityStatus}
                          onChange={(event) =>
                            updateDraft(
                              product.id,
                              "availabilityStatus",
                              event.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                        >
                          <option value="unknown">Unknown</option>
                          <option value="available">Available</option>
                          <option value="limited_stock">Limited stock</option>
                          <option value="out_of_stock">Out of stock</option>
                          <option value="unavailable">Unavailable</option>
                          <option value="restricted">Restricted</option>
                        </select>
                      </label>

                      <label className="text-xs text-gray-500">
                        Publication
                        <select
                          value={draft.publicationStatus}
                          onChange={(event) =>
                            updateDraft(
                              product.id,
                              "publicationStatus",
                              event.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                        >
                          <option value="not_listed">Not listed</option>
                          <option value="pending_review">Pending review</option>
                          <option value="published">Published</option>
                          <option value="held">Held</option>
                          <option value="rejected">Rejected</option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        disabled={savingId === product.id}
                        onClick={() => void saveNigeriaProduct(product)}
                        className="rounded-lg bg-[#17251e] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {savingId === product.id ? "Saving..." : "Save NG"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
