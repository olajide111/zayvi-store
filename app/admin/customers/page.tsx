"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  orderCount: number;
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
  const [query, setQuery] = useState("");

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

  const customers = data?.customers ?? [];
  const search = query.trim().toLowerCase();
  const visible = customers.filter((customer) =>
    [customer.name, customer.email, customer.phone].some((value) => value?.toLowerCase().includes(search)),
  );

  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Store" title="Customers" description="Find customer records and review order activity.">
        <Link href="/admin/orders" prefetch={false} className={adminAction}>Orders</Link>
      </AdminPageHeading>
      <section className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-7 lg:px-8">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Loaded customers", value: customers.length },
            { label: "Returning customers", value: customers.filter((customer) => customer.orderCount > 1).length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[#dfe6e1] bg-white p-3 sm:p-4">
              <p className="text-xs font-medium text-[#52635b]">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{data ? value : "—"}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#dfe6e1] bg-white p-3">
          <input aria-label="Search customers" placeholder="Search name, email or phone" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-lg border border-[#dfe6e1] px-3 text-sm" />
        </div>
        {loading && <p role="status" className="py-8 text-center text-sm text-[#52635b]">Loading customers…</p>}
        {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!loading && !error && (visible.length ? (
          <ul aria-label="Customers" className="divide-y divide-[#e4eae5] rounded-xl border border-[#dfe6e1] bg-white">
            {visible.map((customer) => (
              <li key={customer.id} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 grow">
                  <p className="font-semibold break-words">{customer.name || "Customer"}</p>
                  <p className="mt-0.5 text-sm break-all text-[#52635b]">{customer.email}</p>
                </div>
                <div className="min-w-0 text-xs text-[#52635b]">
                  <p className="font-semibold text-[#215241]">{customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}</p>
                  <p className="mt-0.5">{customer.lastOrderAt ? "Last order " + new Date(customer.lastOrderAt).toLocaleDateString("en-GB") : "No order date"}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-[#dfe6e1] bg-white p-7 text-center">
            <Users size={24} className="mx-auto text-[#215241]" aria-hidden="true" />
            <h2 className="mt-2 font-semibold">{customers.length ? "No matching customers" : "No customer records yet"}</h2>
            <p className="mt-1 text-sm text-[#52635b]">{customers.length ? "Try another name, email or phone." : data?.message || "Customer records appear when draft or live orders are created."}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
