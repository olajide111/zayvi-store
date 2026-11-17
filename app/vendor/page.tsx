"use client";

import { useEffect, useState } from "react";

import { parseSupplierCsv } from "@/lib/supplier-feed-csv";

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

type VendorPurchaseOrder = {
  id: string;
  poNumber: string;
  marketCode: string;
  currency: string;
  status: string;
  notes?: string | null;
  lineCount: number;
  orderedUnits: number;
  receivedUnits: number;
  totalValue: number;
  submittedAt?: string | null;
  supplierAckStatus: "pending" | "acknowledged" | "unable_to_fulfil";
  supplierAcknowledgedAt?: string | null;
  supplierReference?: string | null;
  supplierUpdateNote?: string | null;
  latestCarrier?: string | null;
  latestTrackingNumber?: string | null;
  latestShippedAt?: string | null;
  expectedDeliveryAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type FeedBatch = {
  id: string;
  sourceType: string;
  sourceReference?: string | null;
  itemCount: number;
  acceptedCount: number;
  rejectedCount: number;
  status: string;
  rejectionDetails: Array<{
    index: number;
    externalProductId?: string | null;
    errors: string[];
  }>;
  createdAt: string;
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
  const [feedText, setFeedText] = useState("[]");
  const [feedBatches, setFeedBatches] = useState<FeedBatch[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<VendorPurchaseOrder[]>([]);
  const [submittingFeed, setSubmittingFeed] = useState(false);
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

  async function loadPurchaseOrders() {
    try {
      const response = await fetch("/api/vendor/purchase-orders", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/vendor/access-required";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to load supplier purchase orders."
        );
      }

      setPurchaseOrders(
        Array.isArray(payload.purchaseOrders) ? payload.purchaseOrders : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load supplier purchase orders."
      );
    }
  }

  async function loadFeedHistory() {
    try {
      const response = await fetch("/api/vendor/feed-history", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/vendor/access-required";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to load supplier-feed history."
        );
      }

      setFeedBatches(Array.isArray(payload.batches) ? payload.batches : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load supplier-feed history."
      );
    }
  }

  useEffect(() => {
    void load();
    void loadFeedHistory();
    void loadPurchaseOrders();
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

  async function loadCsvFile(file: File) {
    if (!portal) return;

    setError("");
    setNotice("");

    try {
      const text = await file.text();
      const parsed = parseSupplierCsv(text);
      const currency = portal.account.marketCode === "NG" ? "NGN" : "GBP";
      const normalized = parsed.map((item) => ({
        ...item,
        currency,
      }));

      setFeedText(JSON.stringify(normalized, null, 2));
      setNotice(
        `${normalized.length} CSV row(s) loaded. Review the data, then submit it to Zayvi for review.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to parse supplier CSV."
      );
    }
  }

  async function submitFeed() {
    if (!portal || !canEdit) return;

    let items: unknown;
    try {
      items = JSON.parse(feedText);
    } catch {
      setError("Feed JSON is invalid.");
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      setError("Supplier feed must contain at least one product.");
      return;
    }

    const currency = portal.account.marketCode === "NG" ? "NGN" : "GBP";
    const normalized = items.map((item) => ({
      ...(item && typeof item === "object" ? item : {}),
      currency,
    }));

    setSubmittingFeed(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/vendor/feed", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceType: "file",
          sourceReference: "Vendor portal submission",
          items: normalized,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to submit supplier feed.");
      }

      setNotice(
        payload.duplicatePayload
          ? "This exact supplier feed was already processed; no duplicate batch was created."
          : `Feed submitted: ${payload.acceptedCount} accepted into review, ${payload.rejectedCount} rejected by validation.`
      );
      setFeedText("[]");
      await loadFeedHistory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit supplier feed."
      );
    } finally {
      setSubmittingFeed(false);
    }
  }

  async function updatePurchaseOrder(
    po: VendorPurchaseOrder,
    action: "acknowledge" | "unable_to_fulfil" | "shipment"
  ) {
    if (!canEdit) return;

    const body: Record<string, unknown> = { action };

    if (action === "acknowledge") {
      const reference = window.prompt(
        "Supplier reference (optional)",
        po.supplierReference || ""
      );
      if (reference === null) return;

      const note = window.prompt(
        "Acknowledgement note (optional)",
        po.supplierUpdateNote || ""
      );
      if (note === null) return;

      body.supplierReference = reference.trim() || null;
      body.note = note.trim() || null;
    }

    if (action === "unable_to_fulfil") {
      const note = window.prompt(
        "Explain why this purchase order cannot be fulfilled",
        po.supplierUpdateNote || ""
      );
      if (note === null) return;
      if (!note.trim()) {
        setError("A note is required when you cannot fulfil a purchase order.");
        return;
      }
      body.note = note.trim();
    }

    if (action === "shipment") {
      const carrier = window.prompt("Carrier", po.latestCarrier || "");
      if (carrier === null) return;
      const trackingNumber = window.prompt(
        "Tracking number",
        po.latestTrackingNumber || ""
      );
      if (trackingNumber === null) return;

      if (!carrier.trim() && !trackingNumber.trim()) {
        setError("Provide a carrier or tracking number.");
        return;
      }

      const expectedDeliveryAt = window.prompt(
        "Expected delivery date (YYYY-MM-DD, optional)",
        po.expectedDeliveryAt
          ? new Date(po.expectedDeliveryAt).toISOString().slice(0, 10)
          : ""
      );
      if (expectedDeliveryAt === null) return;

      const note = window.prompt("Shipment note (optional)", "");
      if (note === null) return;

      body.carrier = carrier.trim() || null;
      body.trackingNumber = trackingNumber.trim() || null;
      body.shippedAt = new Date().toISOString();
      body.expectedDeliveryAt = expectedDeliveryAt.trim()
        ? new Date(expectedDeliveryAt + "T23:59:59Z").toISOString()
        : null;
      body.note = note.trim() || null;
    }

    setWorkingId(po.id + ":" + action);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/vendor/purchase-orders/${po.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to update purchase order."
        );
      }

      setNotice(
        action === "shipment"
          ? `${po.poNumber} shipment update recorded.`
          : action === "acknowledge"
            ? `${po.poNumber} acknowledged.`
            : `${po.poNumber} flagged as unable to fulfil.`
      );
      await loadPurchaseOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update purchase order."
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

        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Purchase orders from Zayvi</h2>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              Only Admin-approved and submitted purchase orders appear here. Supplier
              updates are informational and cannot approve, cancel or receive a PO.
            </p>
          </div>

          {purchaseOrders.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No submitted purchase orders are currently assigned to this supplier.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {purchaseOrders.map((po) => (
                <div key={po.id} className="px-5 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold">{po.poNumber}</div>
                      <div className="mt-1 text-xs text-gray-400">
                        {po.marketCode} · {po.lineCount} line(s) · {po.orderedUnits} unit(s) ·{" "}
                        {money(po.totalValue, po.currency)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold capitalize text-gray-600">
                          {po.status.replaceAll("_", " ")}
                        </span>
                        <span
                          className={
                            "rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize " +
                            (po.supplierAckStatus === "acknowledged"
                              ? "bg-emerald-50 text-emerald-700"
                              : po.supplierAckStatus === "unable_to_fulfil"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700")
                          }
                        >
                          {po.supplierAckStatus.replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 lg:text-right">
                      {po.submittedAt && (
                        <div>
                          Submitted {new Date(po.submittedAt).toLocaleString("en-GB")}
                        </div>
                      )}
                      {po.supplierReference && (
                        <div className="mt-1">Ref: {po.supplierReference}</div>
                      )}
                    </div>
                  </div>

                  {po.latestTrackingNumber || po.latestCarrier ? (
                    <div className="mt-4 rounded-xl bg-[#fafbf9] p-3 text-xs text-gray-600">
                      Shipment: {po.latestCarrier || "Carrier not supplied"}
                      {po.latestTrackingNumber
                        ? ` · ${po.latestTrackingNumber}`
                        : ""}
                      {po.expectedDeliveryAt
                        ? ` · expected ${new Date(
                            po.expectedDeliveryAt
                          ).toLocaleDateString("en-GB")}`
                        : ""}
                    </div>
                  ) : null}

                  {po.supplierUpdateNote && (
                    <div className="mt-3 text-xs leading-5 text-gray-500">
                      {po.supplierUpdateNote}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                    {!canEdit ? (
                      <span className="text-xs text-gray-400">
                        Viewer account — purchase orders are read-only.
                      </span>
                    ) : (
                      <>
                        {po.supplierAckStatus !== "acknowledged" &&
                          ["submitted", "partially_received"].includes(po.status) && (
                            <button
                              type="button"
                              disabled={Boolean(workingId)}
                              onClick={() =>
                                void updatePurchaseOrder(po, "acknowledge")
                              }
                              className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                            >
                              Acknowledge
                            </button>
                          )}

                        {po.supplierAckStatus === "pending" &&
                          ["submitted", "partially_received"].includes(po.status) && (
                            <button
                              type="button"
                              disabled={Boolean(workingId)}
                              onClick={() =>
                                void updatePurchaseOrder(po, "unable_to_fulfil")
                              }
                              className="rounded-lg border border-red-100 px-3 py-2 text-[11px] font-semibold text-red-600 disabled:opacity-40"
                            >
                              Unable to fulfil
                            </button>
                          )}

                        {po.supplierAckStatus === "acknowledged" &&
                          ["submitted", "partially_received"].includes(po.status) && (
                            <button
                              type="button"
                              disabled={Boolean(workingId)}
                              onClick={() =>
                                void updatePurchaseOrder(po, "shipment")
                              }
                              className="rounded-lg border border-blue-100 px-3 py-2 text-[11px] font-semibold text-blue-700 disabled:opacity-40"
                            >
                              Add shipment update
                            </button>
                          )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Submit product feed</h2>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              Feed products go to Zayvi Admin for review. Submission never publishes
              products or sets customer prices automatically.
            </p>

            {canEdit ? (
              <>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-500">
                    Supplier CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void loadCsvFile(file);
                      event.currentTarget.value = "";
                    }}
                    className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf4ed] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#31543b]"
                  />
                  <p className="mt-1 text-[11px] leading-4 text-gray-400">
                    Required columns: externalProductId, name and category. SKU,
                    cost, MOQ, lead time, stock state and stock quantity are optional.
                  </p>
                </div>

                <label className="mt-4 block text-xs font-medium text-gray-500">
                  Feed JSON
                </label>
                <textarea
                  value={feedText}
                  onChange={(event) => setFeedText(event.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-[#78927d]"
                />

                <button
                  type="button"
                  disabled={submittingFeed}
                  onClick={() => void submitFeed()}
                  className="mt-4 rounded-xl bg-[#17251e] px-5 py-3 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {submittingFeed ? "Submitting..." : "Submit to Zayvi review"}
                </button>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                Viewer accounts are read-only and cannot submit supplier feeds.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Feed submission history</h2>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              Recent validation outcomes for this supplier only.
            </p>

            {feedBatches.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                No product-feed submissions yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {feedBatches.slice(0, 8).map((batch) => (
                  <details
                    key={batch.id}
                    className="rounded-xl border border-gray-100 bg-[#fafbf9] p-3"
                  >
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold capitalize">
                            {batch.status.replaceAll("_", " ")}
                          </div>
                          <div className="mt-1 text-[11px] text-gray-400">
                            {new Date(batch.createdAt).toLocaleString("en-GB")}
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-gray-500">
                          {batch.acceptedCount} accepted
                          <br />
                          {batch.rejectedCount} rejected
                        </div>
                      </div>
                    </summary>

                    <div className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
                      <div>
                        Items: {batch.itemCount} · Source:{" "}
                        {batch.sourceReference || batch.sourceType}
                      </div>

                      {batch.rejectionDetails.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {batch.rejectionDetails.slice(0, 5).map((rejection) => (
                            <div
                              key={`${batch.id}-${rejection.index}`}
                              className="rounded-lg bg-red-50 p-2 text-red-700"
                            >
                              Row {rejection.index + 1}
                              {rejection.externalProductId
                                ? ` · ${rejection.externalProductId}`
                                : ""}
                              : {rejection.errors.join("; ")}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
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
