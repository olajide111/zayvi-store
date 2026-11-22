"use client";

import Link from "next/link";
import AdminPageHeading, { adminAction, adminPrimaryAction } from "@/components/admin/AdminPageHeading";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  image: string;
  images?: string[];
  price: number;
  category: string;
  desc: string;
  badge?: string;
  status: "draft" | "active" | "paused" | "archived";
  publicationStatus:
    | "not_listed"
    | "pending_review"
    | "published"
    | "held"
    | "rejected"
    | "withdrawn";
};

type ProductsResponse = {
  productGalleryVersion?: number;
  total: number;
  categories: string[];
  products: Product[];
};

type ProductForm = {
  name: string;
  category: string;
  price: string;
  image: string;
  gallery: string;
  desc: string;
  status: Product["status"];
  publicationStatus: Product["publicationStatus"];
};

const emptyForm: ProductForm = {
  name: "",
  category: "Travel",
  price: "",
  image: "",
  gallery: "",
  desc: "",
  status: "active",
  publicationStatus: "pending_review",
};

export default function AdminProductsPage() {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);

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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setCreating(true);
  }

  function openEdit(product: Product) {
    setCreating(false);
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      image: product.image,
      gallery: (product.images||[]).filter(url=>url!==product.image).join("\n"),
      desc: product.desc,
      status: product.status,
      publicationStatus: product.publicationStatus,
    });
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const {gallery,...fields}=form;
      const images=gallery.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
      if(data?.productGalleryVersion===1&&new Set([form.image,...images].filter(Boolean)).size>20)throw new Error("Use at most 20 images including the primary image.");
      const response = await fetch("/api/admin/products", {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          ...fields,
          ...(data?.productGalleryVersion===1?{images}:{}),
          price: Number(form.price),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (editing ? "Unable to update product." : "Unable to create product.")
        );
      }

      closeForm();
      setLoading(true);
      await loadCatalogue();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editing
            ? "Unable to update product."
            : "Unable to create product."
      );
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

  const formOpen = creating || Boolean(editing);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <AdminPageHeading section="Catalogue" title="Products & catalogue" description="Manage products, prices and publication status.">
        <Link href="/admin/product-images" prefetch={false} className={adminAction}>Product images</Link>
        <button type="button" onClick={formOpen ? closeForm : openCreate} className={adminPrimaryAction}>
          {formOpen ? "Close form" : "Add product"}
        </button>
      </AdminPageHeading>

      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        {formOpen && (
          <form
            onSubmit={saveProduct}
            className="mt-6 rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                {editing ? `Edit ${editing.name}` : "Add product"}
              </h2>
              <p className="mt-1 text-xs text-[#52635b]">
                {editing
                  ? "Update catalogue, pricing and publication state."
                  : "Create a new product in the Preview PostgreSQL catalogue."}
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
              <label className="md:col-span-2 grid gap-2 text-sm">Additional product images
                <textarea value={form.gallery} disabled={saving||data?.productGalleryVersion!==1} onChange={event=>setForm(current=>({...current,gallery:event.target.value}))} rows={4} placeholder="One HTTPS image URL per line" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm disabled:bg-gray-100"/>
                <span className="text-xs text-slate-600">{data?.productGalleryVersion===1?'Up to 20 images including the primary image, in the order entered. Upload your own product photos from Product images, then paste their URLs here.':'Gallery editing requires the updated Preview commerce API. Existing single-image editing remains available.'}</span>
              </label>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as Product["status"],
                  }))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={form.publicationStatus}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    publicationStatus: event.target
                      .value as Product["publicationStatus"],
                  }))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="not_listed">Not listed</option>
                <option value="pending_review">Pending review</option>
                <option value="published">Published</option>
                <option value="held">Held</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
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
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Create product"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Products</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">{data?.total ?? "—"}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Categories</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">
              {data?.categories.length ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-[#52635b]">Environment</div>
            <div className="mt-2 text-lg font-semibold text-[#31543b]">Preview</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search products" placeholder="Search products"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#78927d]"
          />
          <select
            aria-label="Category" value={category}
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
            <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-gray-100 bg-[#fafbf9] px-5 py-3 text-xs font-semibold text-gray-400 xl:grid-cols-[minmax(0,1fr)_110px_95px_125px_68px]">
              <span>Product</span>
              <span className="hidden xl:block">Category</span>
              <span className="hidden xl:block">Price</span>
              <span className="hidden xl:block">Publication</span>
              <span>Action</span>
            </div>

            {visibleProducts.map((product) => (
              <div
                key={product.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-b border-gray-100 px-3 py-3.5 sm:gap-4 sm:px-5 last:border-b-0 xl:grid-cols-[minmax(0,1fr)_110px_95px_125px_68px]"
              >
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
                  <img
                    src={product.image}
                    alt=""
                    className="size-10 shrink-0 sm:size-14 rounded-xl border border-gray-100 object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {product.name}
                    </div>
                    <div className="mt-1 truncate text-xs text-[#52635b]">
                      {product.desc}
                    </div>
                    <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      {product.status}
                    </div>
                    <p className="mt-1 text-xs text-[#52635b] xl:hidden">
                      £{Number(product.price).toFixed(2)} · {product.publicationStatus.replaceAll("_", " ")}
                    </p>
                  </div>
                </div>
                <div className="hidden text-sm text-gray-500 xl:block">
                  {product.category}
                </div>
                <div className="hidden text-sm font-semibold xl:block">
                  £{Number(product.price).toFixed(2)}
                </div>
                <div className="hidden text-xs text-gray-500 xl:block">
                  {product.publicationStatus.replaceAll("_", " ")}
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(product)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Edit
                </button>
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
