"use client";

import { use, useEffect, useMemo, useState } from "react";

type VerificationEvent = {
  id: string;
  fromStatus: string;
  toStatus: string;
  reviewNote?: string | null;
  actor: string;
  createdAt: string;
};

type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  supplierType: string;
  marketCode: "GB" | "NG";
  fulfilmentModel: string;
  verificationStatus: string;
  activeOffers: number;
};

type Product = {
  id: string;
  name: string;
  canonicalCode?: string;
};

type Offer = {
  id: string;
  supplierId: string;
  supplierSku?: string | null;
  productId: string;
  productName: string;
  canonicalCode: string;
  currency: string;
  unitCost: number | null;
  minimumOrderQuantity: number;
  leadTimeDays: number | null;
  stockStatus: string;
  externalStockQuantity: number | null;
  sourceUpdatedAt?: string | null;
  status: string;
};

type OfferForm = {
  productId: string;
  supplierSku: string;
  unitCost: string;
  minimumOrderQuantity: string;
  leadTimeDays: string;
  stockStatus: "unknown" | "in_stock" | "limited" | "out_of_stock" | "preorder";
  externalStockQuantity: string;
};

const emptyForm: OfferForm = {
  productId: "",
  supplierSku: "",
  unitCost: "",
  minimumOrderQuantity: "1",
  leadTimeDays: "",
  stockStatus: "unknown",
  externalStockQuantity: "",
};

function money(value: number | null, currency: string) {
  if (value === null) return "No cost";
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(value);
}

export default function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verificationEvents, setVerificationEvents] = useState<VerificationEvent[]>([]);
  const [verificationWorking, setVerificationWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [supplierResponse, productResponse, offersResponse, verificationResponse] =
        await Promise.all([
          fetch("/api/admin/suppliers", {
            credentials: "include",
            cache: "no-store",
          }),
          fetch("/api/admin/products", {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(
            "/api/admin/supplier-offers?supplierId=" + encodeURIComponent(id),
            {
              credentials: "include",
              cache: "no-store",
            }
          ),
          fetch(
            `/api/admin/suppliers/${id}/verification-events`,
            {
              credentials: "include",
              cache: "no-store",
            }
          ),
        ]);

      if (
        supplierResponse.status === 401 ||
        productResponse.status === 401 ||
        offersResponse.status === 401 ||
        verificationResponse.status === 401
      ) {
        window.location.href = "/admin";
        return;
      }

      const supplierPayload = await supplierResponse.json();
      const productPayload = await productResponse.json();
      const offerPayload = await offersResponse.json();
      const verificationPayload = await verificationResponse.json();

      if (!supplierResponse.ok) {
        throw new Error(supplierPayload?.error || "Unable to load supplier.");
      }
      if (!productResponse.ok) {
        throw new Error(productPayload?.error || "Unable to load products.");
      }
      if (!offersResponse.ok) {
        throw new Error(offerPayload?.error || "Unable to load supplier offers.");
      }
      if (!verificationResponse.ok) {
        throw new Error(
          verificationPayload?.error ||
            "Unable to load supplier verification history."
        );
      }

      const match = (supplierPayload.suppliers || []).find(
        (item: Supplier) => item.id === id
      );

      if (!match) {
        throw new Error("Supplier not found.");
      }

      setSupplier(match);
      setProducts(Array.isArray(productPayload.products) ? productPayload.products : []);
      setOffers(Array.isArray(offerPayload.offers) ? offerPayload.offers : []);
      setVerificationEvents(
        Array.isArray(verificationPayload.events)
          ? verificationPayload.events
          : []
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load supplier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const availableProducts = useMemo(() => {
    const linked = new Set(offers.map((offer) => offer.productId));
    return products.filter((product) => !linked.has(product.id));
  }, [products, offers]);

  async function updateVerification(
    verificationStatus: "pending_review" | "verified" | "rejected"
  ) {
    if (!supplier) return;

    let reviewNote: string | null = null;

    if (verificationStatus === "verified") {
      const entered = window.prompt(
        "Verification note (recommended)",
        ""
      );
      if (entered === null) return;
      reviewNote = entered.trim() || null;
    }

    if (verificationStatus === "rejected") {
      const entered = window.prompt(
        "Why is this supplier being rejected?",
        ""
      );
      if (entered === null) return;
      reviewNote = entered.trim();

      if (!reviewNote) {
        setError("A review note is required when rejecting a supplier.");
        return;
      }
    }

    setVerificationWorking(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/suppliers/${supplier.id}/verification`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ verificationStatus, reviewNote }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to update supplier verification."
        );
      }

      setNotice(
        verificationStatus === "verified"
          ? "Supplier verified."
          : verificationStatus === "rejected"
            ? "Supplier rejected."
            : "Supplier returned to pending review."
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update supplier verification."
      );
    } finally {
      setVerificationWorking(false);
    }
  }

  async function saveOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplier) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/supplier-offers", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          productId: form.productId,
          supplierSku: form.supplierSku || null,
          currency: supplier.marketCode === "NG" ? "NGN" : "GBP",
          unitCost: form.unitCost === "" ? null : Number(form.unitCost),
          minimumOrderQuantity: Number(form.minimumOrderQuantity),
          leadTimeDays:
            form.leadTimeDays === "" ? null : Number(form.leadTimeDays),
          stockStatus: form.stockStatus,
          externalStockQuantity:
            form.externalStockQuantity === ""
              ? null
              : Number(form.externalStockQuantity),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save supplier offer.");
      }

      setForm(emptyForm);
      setShowForm(false);
      setNotice("Supplier offer saved.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save supplier offer."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f6] p-10 text-sm text-gray-500">
        Loading supplier...
      </main>
    );
  }

  if (!supplier) {
    return (
      <main className="min-h-screen bg-[#f7f8f6] p-10 text-sm text-red-700">
        {error || "Supplier not found."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1300px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <a
              href="/admin/suppliers"
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← Suppliers
            </a>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              {supplier.name}
            </h1>
            <div className="mt-1 text-xs text-gray-400">
              {supplier.supplierCode} · {supplier.marketCode} ·{" "}
              {supplier.supplierType}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/admin/suppliers/${supplier.id}/portal`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
            >
              Vendor portal access
            </a>
            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              className="rounded-lg bg-[#17251e] px-4 py-2 text-xs font-semibold text-white"
            >
              {showForm ? "Close" : "Add product offer"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1300px] px-5 py-8 md:px-9">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Verification</div>
            <div className="mt-2 text-lg font-semibold capitalize">
              {supplier.verificationStatus.replaceAll("_", " ")}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {supplier.verificationStatus !== "verified" && (
                <button
                  type="button"
                  disabled={verificationWorking}
                  onClick={() => void updateVerification("verified")}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  Mark verified
                </button>
              )}

              {supplier.verificationStatus !== "rejected" && (
                <button
                  type="button"
                  disabled={verificationWorking}
                  onClick={() => void updateVerification("rejected")}
                  className="rounded-lg border border-red-100 px-3 py-2 text-[11px] font-semibold text-red-600 disabled:opacity-40"
                >
                  Reject
                </button>
              )}

              {supplier.verificationStatus !== "pending_review" && (
                <button
                  type="button"
                  disabled={verificationWorking}
                  onClick={() => void updateVerification("pending_review")}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-[11px] font-semibold text-gray-600 disabled:opacity-40"
                >
                  Return to review
                </button>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Fulfilment model</div>
            <div className="mt-2 text-lg font-semibold capitalize">
              {supplier.fulfilmentModel.replaceAll("_", " ")}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Active offers</div>
            <div className="mt-2 text-3xl font-semibold">{offers.length}</div>
          </div>
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={saveOffer}
            className="mt-6 rounded-2xl border border-gray-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold">Link supplier to product</h2>
            <p className="mt-1 text-xs text-gray-400">
              Cost and stock data are supplier-reported commercial inputs, not
              customer-facing prices.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <select
                required
                value={form.productId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productId: event.target.value,
                  }))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">Select product</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>

              <input
                value={form.supplierSku}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supplierSku: event.target.value,
                  }))
                }
                placeholder="Supplier SKU"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unitCost}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unitCost: event.target.value,
                  }))
                }
                placeholder={supplier.marketCode === "NG" ? "Unit cost NGN" : "Unit cost GBP"}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />

              <input
                type="number"
                min="1"
                step="1"
                value={form.minimumOrderQuantity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minimumOrderQuantity: event.target.value,
                  }))
                }
                placeholder="Minimum order quantity"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />

              <input
                type="number"
                min="0"
                step="1"
                value={form.leadTimeDays}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    leadTimeDays: event.target.value,
                  }))
                }
                placeholder="Lead time days"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />

              <select
                value={form.stockStatus}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    stockStatus: event.target.value as OfferForm["stockStatus"],
                  }))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <option value="unknown">Stock unknown</option>
                <option value="in_stock">In stock</option>
                <option value="limited">Limited</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="preorder">Preorder</option>
              </select>

              <input
                type="number"
                min="0"
                step="1"
                value={form.externalStockQuantity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    externalStockQuantity: event.target.value,
                  }))
                }
                placeholder="Reported supplier quantity"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm md:col-span-2"
              />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving || !form.productId}
                className="rounded-xl bg-[#17251e] px-5 py-3 text-xs font-semibold text-white disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save offer"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold">Verification history</h2>
            <p className="mt-1 text-xs text-gray-400">
              Auditable review decisions for this supplier.
            </p>
          </div>

          {verificationEvents.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
              No verification events recorded yet.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
              {verificationEvents.map((event) => (
                <div key={event.id} className="p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-semibold text-gray-700">
                      {event.fromStatus.replaceAll("_", " ")} →{" "}
                      {event.toStatus.replaceAll("_", " ")}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {new Date(event.createdAt).toLocaleString("en-GB")}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Reviewer: {event.actor}
                    {event.reviewNote ? ` · ${event.reviewNote}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Product offers</h2>
            <p className="mt-1 text-xs text-gray-400">
              Supplier commercial terms and external stock signals.
            </p>
          </div>

          {offers.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No products linked to this supplier yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_130px_110px_100px_120px]"
                >
                  <div>
                    <div className="text-sm font-semibold">{offer.productName}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {offer.supplierSku || offer.canonicalCode}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Unit cost</div>
                    <div className="mt-1 text-sm font-semibold">
                      {money(offer.unitCost, offer.currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">MOQ / lead</div>
                    <div className="mt-1 text-sm">
                      {offer.minimumOrderQuantity} /{" "}
                      {offer.leadTimeDays === null
                        ? "—"
                        : offer.leadTimeDays + "d"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Stock</div>
                    <div className="mt-1 text-sm capitalize">
                      {offer.stockStatus.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Reported qty</div>
                    <div className="mt-1 text-sm font-semibold">
                      {offer.externalStockQuantity ?? "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
