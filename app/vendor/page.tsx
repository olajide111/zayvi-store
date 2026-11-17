"use client";

import { useEffect, useState } from "react";

type VendorOffer = {
  id: string;
  supplierSku?: string | null;
  productName: string;
  canonicalCode: string;
  currency: string;
  unitCost: number | null;
  minimumOrderQuantity: number;
  leadTimeDays: number | null;
  stockStatus: "unknown" | "in_stock" | "limited" | "out_of_stock" | "preorder";
  externalStockQuantity: number | null;
  sourceUpdatedAt?: string | null;
  status: string;
};

type VendorPortal = {
  account: {
    id: string;
    supplierId: string;
    supplierName: string;
    supplierCode: string;
    marketCode: "GB" | "NG";
    verificationStatus: string;
    email: string;
    displayName?: string | null;
    role: "owner" | "editor" | "viewer";
  };
  offers: VendorOffer[];
};

type EditState = {
  unitCost: string;
  minimumOrderQuantity: string;
  leadTimeDays: string;
  stockStatus: VendorOffer["stockStatus"];
  externalStockQuantity: string;
};

function money(value: number | null, currency: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(value);
}

function toEditState(offer: VendorOffer): EditState {
  return {
    unitCost: offer.unitCost === null ? "" : String(offer.unitCost),
    minimumOrderQuantity: String(offer.minimumOrderQuantity),
    leadTimeDays: offer.leadTimeDays === null ? "" : String(offer.leadTimeDays),
    stockStatus: offer.stockStatus,
    externalStockQuantity:
      offer.externalStockQuantity === null
        ? ""
        : String(offer.externalStockQuantity),
  };
}

export default function VendorPortalPage() {
  const [portal, setPortal] = useState<VendorPortal | null>(null);
  const [editingId, setEditingId] = useState("");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [workingId, setWorkingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/vendor/context", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/vendor/access-required";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load supplier workspace.");
      }

      setPortal(payload.portal);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load supplier workspace."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveOffer(offer: VendorOffer) {
    if (!edit) return;

    setWorkingId(offer.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/vendor/offers/${offer.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unitCost: edit.unitCost === "" ? null : Number(edit.unitCost),
          minimumOrderQuantity: Number(edit.minimumOrderQuantity),
          leadTimeDays:
            edit.leadTimeDays === "" ? null : Number(edit.leadTimeDays),
          stockStatus: edit.stockStatus,
          externalStockQuantity:
            edit.externalStockQuantity === ""
              ? null
              : Number(edit.externalStockQuantity),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update supplier offer.");
      }

      setNotice(`${offer.productName} updated.`);
      setEditingId("");
      setEdit(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update supplier offer."
      );
    } finally {
      setWorkingId("");
    }
  }

  async function logout() {
    await fetch("/api/vendor/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/vendor/access-required";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7f3] p-10 text-sm text-gray-500">
        Loading supplier workspace...
      </main>
    );
  }

  if (!portal) {
    return (
      <main className="min-h-screen bg-[#f5f7f3] p-10 text-sm text-red-700">
        {error || "Supplier workspace unavailable."}
      </main>
    );
  }

  const canEdit = portal.account.role !== "viewer";

  return (
    <main className="min-h-screen bg-[#f5f7f3] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1300px] items-center justify-between gap-4 px-5 py-5 md:px-9">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63806b]">
              Zayvi Supplier Portal
            </div>
            <h1 className="mt-1 text-xl font-semibold">
              {portal.account.supplierName}
            </h1>
            <div className="mt-1 text-xs text-gray-400">
              {portal.account.supplierCode} · {portal.account.marketCode} ·{" "}
              {portal.account.role}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-[1300px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">
            Supplier-scoped access
          </div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            You can view your supplier records and update commercial offer data.
            Zayvi Admin controls supplier verification, customer pricing, product
            publication, purchase-order approval and fulfilment.
          </p>
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

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Verification</div>
            <div className="mt-2 text-lg font-semibold capitalize">
              {portal.account.verificationStatus.replaceAll("_", " ")}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Portal role</div>
            <div className="mt-2 text-lg font-semibold capitalize">
              {portal.account.role}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Active offers</div>
            <div className="mt-2 text-3xl font-semibold">
              {portal.offers.length}
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Your product offers</h2>
            <p className="mt-1 text-xs text-gray-400">
              Update supplier cost, MOQ, lead time and stock evidence. These are
              supplier inputs and do not change customer-facing prices.
            </p>
          </div>

          {portal.offers.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No supplier offers are linked to this account yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {portal.offers.map((offer) => {
                const isEditing = editingId === offer.id && edit;

                return (
                  <div key={offer.id} className="px-5 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold">
                          {offer.productName}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          {offer.supplierSku || offer.canonicalCode}
                        </div>
                      </div>

                      {!isEditing && canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(offer.id);
                            setEdit(toEditState(offer));
                          }}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-[11px] font-semibold text-gray-600"
                        >
                          Update offer
                        </button>
                      )}
                    </div>

                    {!isEditing ? (
                      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-5">
                        <div>
                          <div className="text-gray-400">Unit cost</div>
                          <div className="mt-1 font-semibold">
                            {money(offer.unitCost, offer.currency)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">MOQ</div>
                          <div className="mt-1 font-semibold">
                            {offer.minimumOrderQuantity}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Lead time</div>
                          <div className="mt-1 font-semibold">
                            {offer.leadTimeDays === null
                              ? "Unknown"
                              : offer.leadTimeDays + "d"}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Stock</div>
                          <div className="mt-1 font-semibold capitalize">
                            {offer.stockStatus.replaceAll("_", " ")}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Reported qty</div>
                          <div className="mt-1 font-semibold">
                            {offer.externalStockQuantity ?? "Unknown"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-gray-100 bg-[#fafbf9] p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={edit.unitCost}
                            onChange={(event) =>
                              setEdit((current) =>
                                current
                                  ? { ...current, unitCost: event.target.value }
                                  : current
                              )
                            }
                            placeholder="Unit cost"
                            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                          />
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={edit.minimumOrderQuantity}
                            onChange={(event) =>
                              setEdit((current) =>
                                current
                                  ? {
                                      ...current,
                                      minimumOrderQuantity: event.target.value,
                                    }
                                  : current
                              )
                            }
                            placeholder="MOQ"
                            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={edit.leadTimeDays}
                            onChange={(event) =>
                              setEdit((current) =>
                                current
                                  ? {
                                      ...current,
                                      leadTimeDays: event.target.value,
                                    }
                                  : current
                              )
                            }
                            placeholder="Lead time days"
                            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                          />
                          <select
                            value={edit.stockStatus}
                            onChange={(event) =>
                              setEdit((current) =>
                                current
                                  ? {
                                      ...current,
                                      stockStatus:
                                        event.target
                                          .value as EditState["stockStatus"],
                                    }
                                  : current
                              )
                            }
                            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                          >
                            <option value="unknown">Unknown</option>
                            <option value="in_stock">In stock</option>
                            <option value="limited">Limited</option>
                            <option value="out_of_stock">Out of stock</option>
                            <option value="preorder">Preorder</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={edit.externalStockQuantity}
                            onChange={(event) =>
                              setEdit((current) =>
                                current
                                  ? {
                                      ...current,
                                      externalStockQuantity: event.target.value,
                                    }
                                  : current
                              )
                            }
                            placeholder="Reported stock quantity"
                            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm md:col-span-2"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId("");
                              setEdit(null);
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-[11px] font-semibold text-gray-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={workingId === offer.id}
                            onClick={() => void saveOffer(offer)}
                            className="rounded-lg bg-[#17251e] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                          >
                            Save supplier data
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 text-xs leading-5 text-gray-400">
          Signed in as {portal.account.email}
          {portal.account.displayName
            ? ` · ${portal.account.displayName}`
            : ""}
        </div>
      </section>
    </main>
  );
}
