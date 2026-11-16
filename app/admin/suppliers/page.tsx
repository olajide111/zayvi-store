"use client";

import { useEffect, useMemo, useState } from "react";

type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  supplierType: string;
  marketCode: string;
  fulfilmentModel: string;
  status: string;
  verificationStatus: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  activeOffers: number;
  createdAt: string;
  updatedAt: string;
};

type SuppliersResponse = {
  source: string;
  total: number;
  suppliers: Supplier[];
};

type SupplierForm = {
  name: string;
  supplierType: "dropship" | "wholesale" | "manufacturer" | "3pl";
  marketCode: "GB" | "NG";
  fulfilmentModel: "supplier_fulfilled" | "zayvi_fulfilled" | "3pl_fulfilled";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
};

const emptyForm: SupplierForm = {
  name: "",
  supplierType: "dropship",
  marketCode: "GB",
  fulfilmentModel: "supplier_fulfilled",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  website: "",
};

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const positive = ["verified", "active"].includes(normalized);
  const warning = ["pending_review", "unverified"].includes(normalized);

  return (
    <span
      className={
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize " +
        (positive
          ? "bg-emerald-50 text-emerald-700"
          : warning
            ? "bg-amber-50 text-amber-700"
            : "bg-gray-100 text-gray-600")
      }
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default function AdminSuppliersPage() {
  const [data, setData] = useState<SuppliersResponse | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadSuppliers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/suppliers", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load suppliers.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load suppliers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSuppliers();
  }, []);

  async function createSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to create supplier.");
      }

      setForm(emptyForm);
      setShowForm(false);
      setNotice("Supplier added and queued for verification review.");
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create supplier.");
    } finally {
      setSaving(false);
    }
  }

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (data?.suppliers ?? []).filter(
      (supplier) =>
        !normalized ||
        supplier.name.toLowerCase().includes(normalized) ||
        supplier.supplierCode.toLowerCase().includes(normalized) ||
        supplier.supplierType.toLowerCase().includes(normalized)
    );
  }, [data, query]);

  const verified =
    data?.suppliers.filter((supplier) => supplier.verificationStatus === "verified")
      .length ?? 0;
  const activeOffers =
    data?.suppliers.reduce((sum, supplier) => sum + supplier.activeOffers, 0) ?? 0;

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Suppliers</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Suppliers</h1>
          </div>
          <div className="flex gap-2">
            <a
              href="/admin/dashboard"
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
            >
              Back to overview
            </a>
            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              className="rounded-lg bg-[#17251e] px-4 py-2 text-xs font-semibold text-white"
            >
              {showForm ? "Close" : "Add supplier"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5">
          <div className="text-sm font-semibold text-[#23432d]">Supplier registry is active</div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#55705b]">
            Zayvi now stores dropship, wholesale, manufacturer and 3PL supplier records.
            New suppliers remain pending review until verification is completed.
          </p>
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={createSupplier}
            className="mt-6 rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Add supplier</h2>
              <p className="mt-1 text-xs text-gray-400">
                Supplier verification starts as pending review.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Supplier name"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
              />

              <select
                value={form.supplierType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supplierType: event.target.value as SupplierForm["supplierType"],
                  }))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <option value="dropship">Dropship</option>
                <option value="wholesale">Wholesale</option>
                <option value="manufacturer">Manufacturer</option>
                <option value="3pl">3PL</option>
              </select>

              <select
                value={form.marketCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    marketCode: event.target.value as SupplierForm["marketCode"],
                  }))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <option value="GB">United Kingdom</option>
                <option value="NG">Nigeria</option>
              </select>

              <select
                value={form.fulfilmentModel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fulfilmentModel: event.target.value as SupplierForm["fulfilmentModel"],
                  }))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <option value="supplier_fulfilled">Supplier fulfilled</option>
                <option value="zayvi_fulfilled">Zayvi fulfilled</option>
                <option value="3pl_fulfilled">3PL fulfilled</option>
              </select>

              <input
                value={form.contactName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactName: event.target.value }))
                }
                placeholder="Contact name"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />

              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactEmail: event.target.value }))
                }
                placeholder="Contact email"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />

              <input
                value={form.contactPhone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactPhone: event.target.value }))
                }
                placeholder="Contact phone"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />

              <input
                value={form.website}
                onChange={(event) =>
                  setForm((current) => ({ ...current, website: event.target.value }))
                }
                placeholder="Website"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#17251e] px-5 py-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Add supplier"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Suppliers</div>
            <div className="mt-2 text-3xl font-semibold">{data?.total ?? "—"}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Verified</div>
            <div className="mt-2 text-3xl font-semibold">{verified}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Active offers</div>
            <div className="mt-2 text-3xl font-semibold">{activeOffers}</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search supplier, code or type"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
          />
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">Loading suppliers...</div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[1fr_110px] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 md:grid-cols-[minmax(0,1fr)_120px_110px_150px_120px_100px]">
              <span>Supplier</span>
              <span className="hidden md:block">Market</span>
              <span className="hidden md:block">Type</span>
              <span className="hidden md:block">Fulfilment</span>
              <span className="hidden md:block">Verification</span>
              <span>Offers</span>
            </div>

            {visible.map((supplier) => (
              <div
                key={supplier.id}
                className="grid grid-cols-[1fr_110px] items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_120px_110px_150px_120px_100px]"
              >
                <div className="min-w-0">
                  <a
                    href={`/admin/suppliers/${supplier.id}`}
                    className="truncate text-sm font-semibold text-[#23432d] hover:underline"
                  >
                    {supplier.name}
                  </a>
                  <div className="mt-1 text-xs text-gray-400">
                    {supplier.supplierCode}
                    {supplier.contactEmail ? ` · ${supplier.contactEmail}` : ""}
                  </div>
                </div>
                <div className="hidden text-xs text-gray-600 md:block">
                  {supplier.marketCode}
                </div>
                <div className="hidden text-xs capitalize text-gray-600 md:block">
                  {supplier.supplierType}
                </div>
                <div className="hidden text-xs capitalize text-gray-600 md:block">
                  {supplier.fulfilmentModel.replaceAll("_", " ")}
                </div>
                <div className="hidden md:block">
                  <StatusPill value={supplier.verificationStatus} />
                </div>
                <div className="text-sm font-semibold">{supplier.activeOffers}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ed] text-xl text-[#31543b]">
              ⌑
            </div>
            <h2 className="mt-5 text-base font-semibold">No suppliers configured</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
              Add the first supplier to begin building the dropship, wholesale or 3PL network.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
