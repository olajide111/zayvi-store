"use client";

import { useEffect, useState } from "react";

type CustomersResponse = {
  total: number;
  customers: Array<unknown>;
  message?: string;
};

export default function AdminCustomersPage() {
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/customers", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Unable to load customers.");
        return payload;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load customers."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div><div className="text-xs text-gray-400">Workspace / Customers</div><h1 className="mt-1 text-xl font-semibold text-[#17251e]">Customers</h1></div>
          <a href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">Back to overview</a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Customers</div><div className="mt-2 text-3xl font-semibold">{data?.total ?? "—"}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Returning</div><div className="mt-2 text-3xl font-semibold">0</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Customer value</div><div className="mt-2 text-3xl font-semibold">£0.00</div></div>
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading customers...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {!loading && !error && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ed] text-xl text-[#31543b]">♙</div>
            <h2 className="mt-5 text-base font-semibold">No customer records yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">{data?.message || "Customers will appear here when checkout is enabled."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
