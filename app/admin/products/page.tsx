"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
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
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Travel",
    price: "",
    image: "",
    desc: "",
  });

  async function loadCatalogue() {
    try {
      const response = await fetch("/api/admin/products", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to load catalogue.");
      }

      setData(await response.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load catalogue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalogue();
  }, []);

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to create product.");
      }

      setForm({
        name: "",
        category: "Travel",
        price: "",
        image: "",
        desc: "",
      });
      setCreating(false);
      setLoading(true);
      await loadCatalogue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create product.");
    } finally {
      setSaving(false);
    }
  }

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
            <button
              type="button"
              onClick={() => setCreating((value) => !value)}
              className="rounded-lg bg-[#17251e] px-4 py-2 text-xs font-semibold text-white"
            >
              {creating ? "Close form" : "Add product"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5">
          <div className="text-sm font-semibold text-[#23432d]">
            Catalogue management is now active in Preview
          </div>
          <p className="mt-1 text-xs leading-5 text-[#55705b]">
            This page is wired to the Zayvi AWS Preview API and PostgreSQL catalogue.
            Product creation remains Preview-only and does not affect Production.
          </p>
        </div>

        {creating && (
          <form
            onSubmit={createProduct}
            className="mt-6 rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Add product</h2>
              <p className="mt-1 text-xs text-gray-400">
                Creates the product in the Zayvi Preview PostgreSQL catalogue.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Product name"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
              />
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option>Travel</option>
                <option>Carry</option>
                <option>Recovery</option>
                <option>Daily</option>
              </select>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) =>
                  setForm((current) => ({ ...current, price: event.target.value }))
                }
                placeholder="Price in GBP"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
              />
              <input
                value={form.image}
                onChange={(event) =>
                  setForm((current) => ({ ...current, image: event.target.value }))
                }
                placeholder="Image URL"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
              />
              <textarea
                value={form.desc}
                onChange={(event) =>
                  setForm((current) => ({ ...current, desc: event.target.value }))
                }
                placeholder="Short description"
                rows={3}
                className="md:col-span-2 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                disabled={saving}
                type="submit"
                className="rounded-lg bg-[#17251e] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Create product"}
              </button>
            </div>
          </form>
        )}

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
