"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  image: string;
  price: number;
  category: string;
  desc: string;
  badge?: string;
};

type ProductsResponse = {
  total: number;
  categories: string[];
  products: Product[];
};

export default function AdminProductsPage() {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/products", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }
        if (!response.ok) throw new Error("Unable to load catalogue.");
        return response.json();
      })
      .then((result) => {
        if (result) setData(result);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load catalogue.")
      )
      .finally(() => setLoading(false));
  }, []);

  const visibleProducts = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();

    return data.products.filter((product) => {
      const matchesCategory = category === "All" || product.category === category;
      const matchesQuery =
        !normalized ||
        product.name.toLowerCase().includes(normalized) ||
        product.desc.toLowerCase().includes(normalized);

      return matchesCategory && matchesQuery;
    });
  }, [data, query, category]);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Catalogue</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Products & Catalogue
            </h1>
          </div>
          <div className="flex gap-2">
            <a
              href="/admin/dashboard"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Back to overview
            </a>
            <a
              href="/admin"
              className="rounded-lg bg-[#17251e] px-4 py-2 text-xs font-semibold text-white"
            >
              Upload images
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5">
          <div className="text-sm font-semibold text-[#23432d]">
            Catalogue management is now active in Preview
          </div>
          <p className="mt-1 text-xs leading-5 text-[#55705b]">
            This page reads the catalogue currently powering the Zayvi storefront.
            The AWS catalogue tables are live; create/edit persistence is the next
            backend step before we switch this page from the current catalogue file
            to PostgreSQL.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Products</div>
            <div className="mt-2 text-3xl font-semibold">{data?.total ?? "—"}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Categories</div>
            <div className="mt-2 text-3xl font-semibold">
              {data?.categories.length ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Environment</div>
            <div className="mt-2 text-lg font-semibold text-[#31543b]">Preview</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option>All</option>
            {data?.categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading catalogue...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[1fr_auto] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 md:grid-cols-[minmax(0,1.4fr)_160px_120px_110px]">
              <span>Product</span>
              <span className="hidden md:block">Category</span>
              <span className="hidden md:block">Price</span>
              <span>Status</span>
            </div>

            {visibleProducts.map((product) => (
              <div
                key={product.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_160px_120px_110px]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <img
                    src={product.image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl border border-gray-100 object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {product.name}
                    </div>
                    <div className="mt-1 truncate text-xs text-gray-400">
                      {product.desc}
                    </div>
                  </div>
                </div>
                <div className="hidden text-sm text-gray-500 md:block">
                  {product.category}
                </div>
                <div className="hidden text-sm font-semibold md:block">
                  £{product.price.toFixed(2)}
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-center text-xs font-medium text-emerald-700">
                  Active
                </span>
              </div>
            ))}

            {visibleProducts.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-400">
                No products match your search.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
