"use client";

import { useEffect, useState } from "react";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  orderCount: number;
  lifetimeValue: number;
  firstOrderAt?: string | null;
  lastOrderAt?: string | null;
  createdAt: string;
};

type CustomersResponse = {
  total: number;
  customers: Customer[];
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
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Returning</div><div className="mt-2 text-3xl font-semibold">{data?.customers.filter((customer) => customer.orderCount > 1).length ?? "—"}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Customer value</div><div className="mt-2 text-3xl font-semibold">£{(data?.customers.reduce((sum, customer) => sum + Number(customer.lifetimeValue || 0), 0) ?? 0).toFixed(2)}</div></div>
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading customers...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {!loading && !error && (data?.customers.length ?? 0) > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[1fr_90px_110px] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 md:grid-cols-[minmax(0,1fr)_150px_120px_120px]">
              <span>Customer</span>
              <span className="hidden md:block">Orders</span>
              <span>Value</span>
              <span>Last order</span>
            </div>
            {data?.customers.map((customer) => (
              <div key={customer.id} className="grid grid-cols-[1fr_90px_110px] items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_150px_120px_120px]">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{customer.name}</div>
                  <div className="mt-1 truncate text-xs text-gray-400">{customer.email}</div>
                </div>
                <div className="hidden text-sm text-gray-600 md:block">{customer.orderCount}</div>
                <div className="text-sm font-semibold">£{Number(customer.lifetimeValue).toFixed(2)}</div>
                <div className="text-xs text-gray-500">{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("en-GB") : "—"}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && (data?.customers.length ?? 0) === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ed] text-xl text-[#31543b]">♙</div>
            <h2 className="mt-5 text-base font-semibold">No customer records yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">{data?.message || "Customer records will appear here when draft or live orders are created."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
