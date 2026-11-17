"use client";

import { useEffect, useMemo, useState } from "react";

type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  marketCode: "GB" | "NG";
  verificationStatus: string;
  status: string;
};

type Candidate = {
  id: string;
  externalProductId: string;
  supplierId: string;
  supplierName: string;
  supplierSku?: string | null;
  marketCode: "GB" | "NG";
  name: string;
  category: string;
  description?: string | null;
  imageUrl?: string | null;
  currency: string;
  unitCost: number | null;
  minimumOrderQuantity: number;
  leadTimeDays: number | null;
  stockStatus: string;
  externalStockQuantity: number | null;
  status: string;
  reviewNote?: string | null;
  approvedProductId?: string | null;
  updatedAt: string;
  qualityFlags: string[];
  potentialDuplicate?: {
    productId: string;
    productName: string;
    matchType: "supplier_sku" | "name";
  } | null;
};

type CandidatesResponse = {
  total: number;
  candidates: Candidate[];
  autoPublishEnabled: boolean;
};

type FeedBatch = {
  id: string;
  supplierId: string;
  supplierName: string;
  marketCode: "GB" | "NG";
  sourceType: string;
  sourceReference?: string | null;
  itemCount: number;
  acceptedCount: number;
  rejectedCount: number;
  status: string;
  payloadChecksum?: string | null;
  acceptedDetails: Array<{
    id?: string;
    externalProductId?: string | null;
    status?: string;
  }>;
  rejectionDetails: Array<{
    index: number;
    externalProductId?: string | null;
    errors: string[];
  }>;
  createdAt: string;
};

const sampleFeed = JSON.stringify(
  [
    {
      externalProductId: "SUP-001",
      supplierSku: "SKU-001",
      name: "Example supplier product",
      category: "General",
      description: "Supplier-provided product description.",
      imageUrl: "",
      currency: "GBP",
      unitCost: 10,
      minimumOrderQuantity: 1,
      leadTimeDays: 3,
      stockStatus: "in_stock",
      externalStockQuantity: 25,
    },
  ],
  null,
  2
);

function money(value: number | null, currency: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(value);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one product row.");
  }

  const normalizeHeader = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  const headers = rows[0].map(normalizeHeader);

  const aliases: Record<string, string[]> = {
    externalProductId: ["externalproductid", "externalid", "productid", "id"],
    supplierSku: ["suppliersku", "sku"],
    name: ["name", "productname", "title"],
    category: ["category", "productcategory", "type"],
    description: ["description", "desc"],
    imageUrl: ["imageurl", "image", "imageuri"],
    currency: ["currency", "currencycode"],
    unitCost: ["unitcost", "cost", "suppliercost"],
    minimumOrderQuantity: ["minimumorderquantity", "moq"],
    leadTimeDays: ["leadtimedays", "leadtime"],
    stockStatus: ["stockstatus", "availability", "status"],
    externalStockQuantity: [
      "externalstockquantity",
      "stockquantity",
      "quantity",
      "qty",
    ],
  };

  const indexFor = (key: string) =>
    headers.findIndex((header) => aliases[key]?.includes(header));

  const required = ["externalProductId", "name", "category"];
  for (const key of required) {
    if (indexFor(key) < 0) {
      throw new Error(
        `CSV is missing required column: ${key}. Required columns are externalProductId, name and category.`
      );
    }
  }

  const get = (values: string[], key: string) => {
    const position = indexFor(key);
    return position < 0 ? "" : (values[position] || "").trim();
  };

  return rows.slice(1).map((values) => ({
    externalProductId: get(values, "externalProductId"),
    supplierSku: get(values, "supplierSku") || undefined,
    name: get(values, "name"),
    category: get(values, "category"),
    description: get(values, "description") || undefined,
    imageUrl: get(values, "imageUrl") || undefined,
    currency: get(values, "currency") || undefined,
    unitCost: get(values, "unitCost") === "" ? undefined : Number(get(values, "unitCost")),
    minimumOrderQuantity:
      get(values, "minimumOrderQuantity") === ""
        ? 1
        : Number(get(values, "minimumOrderQuantity")),
    leadTimeDays:
      get(values, "leadTimeDays") === ""
        ? undefined
        : Number(get(values, "leadTimeDays")),
    stockStatus: get(values, "stockStatus") || "unknown",
    externalStockQuantity:
      get(values, "externalStockQuantity") === ""
        ? undefined
        : Number(get(values, "externalStockQuantity")),
  }));
}

export default function ProductDiscoveryPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [feedText, setFeedText] = useState(sampleFeed);
  const [status, setStatus] = useState("pending_review");
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [batches, setBatches] = useState<FeedBatch[]>([]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [supplierResponse, candidateResponse, batchResponse] = await Promise.all([
        fetch("/api/admin/suppliers", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(
          "/api/admin/discovery/candidates?status=" +
            encodeURIComponent(status),
          {
            credentials: "include",
            cache: "no-store",
          }
        ),
        fetch("/api/admin/discovery/batches", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (
        supplierResponse.status === 401 ||
        candidateResponse.status === 401 ||
        batchResponse.status === 401
      ) {
        window.location.href = "/admin";
        return;
      }

      const supplierPayload = await supplierResponse.json();
      const candidatePayload = await candidateResponse.json();
      const batchPayload = await batchResponse.json();

      if (!supplierResponse.ok) {
        throw new Error(supplierPayload?.error || "Unable to load suppliers.");
      }
      if (!candidateResponse.ok) {
        throw new Error(
          candidatePayload?.error || "Unable to load discovery candidates."
        );
      }
      if (!batchResponse.ok) {
        throw new Error(
          batchPayload?.error || "Unable to load supplier-feed history."
        );
      }

      const verified = (supplierPayload.suppliers || []).filter(
        (supplier: Supplier) =>
          supplier.verificationStatus === "verified" &&
          supplier.status === "active"
      );

      setSuppliers(verified);
      setCandidates(
        Array.isArray(candidatePayload.candidates)
          ? candidatePayload.candidates
          : []
      );
      setBatches(
        Array.isArray(batchPayload.batches) ? batchPayload.batches : []
      );

      if (!supplierId && verified.length > 0) {
        setSupplierId(verified[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load product discovery."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === supplierId) || null,
    [suppliers, supplierId]
  );

  useEffect(() => {
    if (!selectedSupplier) return;

    try {
      const parsed = JSON.parse(feedText);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const currency = selectedSupplier.marketCode === "NG" ? "NGN" : "GBP";
      const normalized = parsed.map((item) => ({
        ...item,
        currency,
      }));
      setFeedText(JSON.stringify(normalized, null, 2));
    } catch {
      // Leave user-edited JSON untouched if it is temporarily invalid.
    }
  }, [supplierId]);

  async function loadCsvFile(file: File) {
    setError("");
    setNotice("");

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const currency = selectedSupplier?.marketCode === "NG" ? "NGN" : "GBP";
      const normalized = parsed.map((item) => ({
        ...item,
        currency,
      }));
      setFeedText(JSON.stringify(normalized, null, 2));
      setNotice(`${normalized.length} CSV row(s) loaded. Review the JSON, then import to the review queue.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse CSV file.");
    }
  }

  async function ingest() {
    if (!supplierId) {
      setError("Select a verified supplier first.");
      return;
    }

    let items: unknown;
    try {
      items = JSON.parse(feedText);
    } catch {
      setError("Feed JSON is invalid.");
      return;
    }

    if (!Array.isArray(items)) {
      setError("Feed payload must be a JSON array.");
      return;
    }

    setIngesting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/discovery/ingest", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId,
          sourceType: "manual",
          sourceReference: "Admin JSON import",
          items,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to ingest supplier feed.");
      }

      setNotice(
        `Feed processed: ${payload.acceptedCount} accepted, ${payload.rejectedCount} rejected.`
      );
      setStatus("pending_review");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to ingest supplier feed."
      );
    } finally {
      setIngesting(false);
    }
  }

  async function approve(candidate: Candidate) {
    let confirmDuplicateReview = false;

    if (candidate.potentialDuplicate) {
      const confirmed = window.confirm(
        `Potential duplicate detected: ${candidate.potentialDuplicate.productName} (${candidate.potentialDuplicate.matchType.replaceAll("_", " ")}). Approve this candidate anyway after review?`
      );

      if (!confirmed) return;
      confirmDuplicateReview = true;
    }
    const defaultPrice =
      candidate.unitCost === null
        ? ""
        : String(
            Number(
              (candidate.unitCost * 1.5).toFixed(
                candidate.currency === "NGN" ? 0 : 2
              )
            )
          );

    const rawPrice = window.prompt(
      `Set customer price for ${candidate.name} (${candidate.currency})`,
      defaultPrice
    );
    if (rawPrice === null) return;

    const customerPrice = Number(rawPrice);
    if (!Number.isFinite(customerPrice) || customerPrice < 0) {
      setError("Customer price must be a non-negative number.");
      return;
    }

    const note = window.prompt(
      candidate.potentialDuplicate
        ? "Approval note (required for potential duplicate)"
        : "Approval note (optional)",
      ""
    );
    if (note === null) return;

    if (candidate.potentialDuplicate && !note.trim()) {
      setError("A review note is required when approving a potential duplicate.");
      return;
    }

    setWorkingId(candidate.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/discovery/candidates/${candidate.id}/approve`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerPrice,
            reviewNote: note.trim() || null,
            confirmDuplicateReview,
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to approve discovery candidate."
        );
      }

      setNotice(
        `${candidate.name} added to the catalogue in pending-review state.`
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to approve discovery candidate."
      );
    } finally {
      setWorkingId("");
    }
  }

  async function reject(candidate: Candidate) {
    const note = window.prompt(
      `Why are you rejecting ${candidate.name}?`,
      ""
    );
    if (note === null) return;

    if (!note.trim()) {
      setError("A rejection note is required.");
      return;
    }

    setWorkingId(candidate.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/discovery/candidates/${candidate.id}/reject`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewNote: note.trim() }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to reject discovery candidate."
        );
      }

      setNotice(`${candidate.name} rejected.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reject discovery candidate."
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">
              Workspace / Product discovery
            </div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Supplier product discovery
            </h1>
          </div>
          <a
            href="/admin/products"
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Products
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">
            Review-first discovery
          </div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            Supplier feed items become review candidates only. Approval requires
            an explicit customer price and creates a catalogue product in pending
            review. Nothing is published automatically.
          </p>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <div className="space-y-6">
          <aside className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Import supplier feed</h2>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              This manual JSON importer is the first ingestion adapter. API,
              file and connector sources can use the same backend contract later.
            </p>

            <label className="mt-5 block text-xs font-medium text-gray-500">
              Verified supplier
            </label>
            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
            >
              {suppliers.length === 0 && (
                <option value="">No verified suppliers</option>
              )}
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} · {supplier.marketCode}
                </option>
              ))}
            </select>

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
                Required CSV columns: externalProductId, name, category. Common aliases such as id, title, sku, cost, moq and quantity are supported.
              </p>
            </div>

            <label className="mt-4 block text-xs font-medium text-gray-500">
              Feed JSON
            </label>
            <textarea
              value={feedText}
              onChange={(event) => setFeedText(event.target.value)}
              rows={20}
              spellCheck={false}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-[#78927d]"
            />

            <button
              type="button"
              disabled={ingesting || !supplierId}
              onClick={() => void ingest()}
              className="mt-4 w-full rounded-xl bg-[#17251e] px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {ingesting ? "Processing feed..." : "Import to review queue"}
            </button>
          </aside>

          <aside className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Feed history</h2>
                <p className="mt-1 text-xs text-gray-400">
                  Recent supplier ingestion batches and validation outcomes.
                </p>
              </div>
              <a
                href="/admin/discovery"
                className="text-[11px] font-semibold text-[#31543b] hover:underline"
              >
                Refresh
              </a>
            </div>

            {batches.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-4 text-xs text-gray-500">
                No supplier feed batches recorded yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {batches.slice(0, 8).map((batch) => (
                  <details
                    key={batch.id}
                    className="rounded-xl border border-gray-100 bg-[#fafbf9] p-3"
                  >
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold">
                            {batch.supplierName}
                          </div>
                          <div className="mt-1 text-[11px] text-gray-400">
                            {new Date(batch.createdAt).toLocaleString("en-GB")} · {batch.sourceType}
                          </div>
                        </div>
                        <div className="text-right text-[11px]">
                          <div className="font-semibold capitalize">
                            {batch.status.replaceAll("_", " ")}
                          </div>
                          <div className="mt-1 text-gray-400">
                            {batch.acceptedCount} accepted · {batch.rejectedCount} rejected
                          </div>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
                      <div>
                        Items: {batch.itemCount} · Market: {batch.marketCode}
                      </div>
                      {batch.sourceReference && (
                        <div className="mt-1">
                          Source: {batch.sourceReference}
                        </div>
                      )}
                      {batch.rejectionDetails.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="font-semibold text-red-700">
                            Rejected rows
                          </div>
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
          </aside>
          </div>

          <div>
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Discovery candidates</div>
                <div className="mt-1 text-xs text-gray-400">
                  {candidates.length} item(s) in this view
                </div>
              </div>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs"
              >
                <option value="pending_review">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
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

            {loading ? (
              <div className="py-16 text-center text-sm text-gray-400">
                Loading discovery candidates...
              </div>
            ) : candidates.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-12 text-center">
                <h2 className="text-base font-semibold">No candidates here</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
                  Import a feed from a verified supplier or switch the review
                  status filter.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {candidates.map((candidate) => {
                  return (
                    <section
                      key={candidate.id}
                      className="rounded-2xl border border-gray-200 bg-white p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 gap-4">
                          {candidate.imageUrl ? (
                            <img
                              src={candidate.imageUrl}
                              alt=""
                              className="h-16 w-16 rounded-xl border border-gray-100 object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
                              No image
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">
                              {candidate.name}
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              {candidate.supplierName} ·{" "}
                              {candidate.supplierSku ||
                                candidate.externalProductId}
                            </div>
                            <div className="mt-2 text-xs text-gray-600">
                              {candidate.category}
                            </div>
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <div className="text-[11px] uppercase tracking-wide text-gray-400">
                            Supplier cost
                          </div>
                          <div className="mt-1 text-lg font-semibold">
                            {money(candidate.unitCost, candidate.currency)}
                          </div>
                          <div className="mt-1 text-xs capitalize text-gray-500">
                            {candidate.status.replaceAll("_", " ")}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-4">
                        <div>
                          <div className="text-gray-400">Stock</div>
                          <div className="mt-1 font-semibold capitalize">
                            {candidate.stockStatus.replaceAll("_", " ")}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Reported qty</div>
                          <div className="mt-1 font-semibold">
                            {candidate.externalStockQuantity ?? "Unknown"}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">MOQ</div>
                          <div className="mt-1 font-semibold">
                            {candidate.minimumOrderQuantity}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Lead time</div>
                          <div className="mt-1 font-semibold">
                            {candidate.leadTimeDays === null
                              ? "Unknown"
                              : candidate.leadTimeDays + "d"}
                          </div>
                        </div>
                      </div>

                      {candidate.qualityFlags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {candidate.qualityFlags.map((flag) => (
                            <span
                              key={flag}
                              className={
                                "rounded-full px-2.5 py-1 text-[10px] font-semibold " +
                                (flag === "potential_duplicate"
                                  ? "bg-red-50 text-red-700"
                                  : flag === "missing_unit_cost" || flag === "out_of_stock"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-gray-100 text-gray-600")
                              }
                            >
                              {flag.replaceAll("_", " ")}
                            </span>
                          ))}
                        </div>
                      )}

                      {candidate.potentialDuplicate && (
                        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                          Potential duplicate: {candidate.potentialDuplicate.productName} · matched by{" "}
                          {candidate.potentialDuplicate.matchType.replaceAll("_", " ")}
                        </div>
                      )}

                      {candidate.description && (
                        <p className="mt-4 text-xs leading-5 text-gray-500">
                          {candidate.description}
                        </p>
                      )}

                      {candidate.reviewNote && (
                        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
                          Review note: {candidate.reviewNote}
                        </div>
                      )}

                      {candidate.status === "pending_review" && (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                          <button
                            type="button"
                            disabled={workingId === candidate.id}
                            onClick={() => void approve(candidate)}
                            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            Approve to catalogue
                          </button>
                          <button
                            type="button"
                            disabled={workingId === candidate.id}
                            onClick={() => void reject(candidate)}
                            className="rounded-lg border border-red-100 px-4 py-2 text-xs font-semibold text-red-600 disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {candidate.status === "approved" &&
                        candidate.approvedProductId && (
                          <div className="mt-4 border-t border-gray-100 pt-4">
                            <a
                              href="/admin/products"
                              className="text-xs font-semibold text-[#23432d] hover:underline"
                            >
                              View catalogue →
                            </a>
                          </div>
                        )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
