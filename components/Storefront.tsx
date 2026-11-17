"use client";

import { Search } from "lucide-react";
import { cartStorageKey, type StorefrontMarketSettings } from "@/lib/storefront-market";
import type { ContentMarket } from "@/lib/storefront-content";
import type { DraftOrderDetails, DraftOrderReceipt } from "@/lib/delivery";
import { useState, useEffect, useRef } from "react";
import type { StorefrontProduct, StorefrontProductsResponse } from "@/lib/storefront-products";
import MarketSwitcher from "@/components/MarketSwitcher";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import BestSellers from "@/components/BestSellers";
import CategoryGrid from "@/components/CategoryGrid";
import ProductCard from "@/components/ProductCard";
import CartDrawer, { type CartItem } from "@/components/CartDrawer";
import QuickView from "@/components/QuickView";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";

const STORE_COLOR = "#171714";
const ORDER_IDEMPOTENCY_STORAGE_KEY = "zayvi-order-idempotency-v2";

export default function Storefront({ marketCode, marketSettings }: {
  marketCode: ContentMarket;
  marketSettings: StorefrontMarketSettings;
}) {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [verifiedSubtotal, setVerifiedSubtotal] = useState<number | null>(null);
  const [pricingState, setPricingState] = useState<"idle" | "checking" | "verified" | "error">("idle");
  const [cartOpen, setCartOpen] = useState(false);
  const [qv, setQv] = useState<StorefrontProduct | null>(null);
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const gridRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const bestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        setCatalogueLoading(true);
        const response = await fetch(
          `/api/storefront/products?market=${encodeURIComponent(marketCode)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as StorefrontProductsResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load the catalogue.");
        }

        if (!cancelled) {
          setProducts(Array.isArray(payload.products) ? payload.products : []);
          setCatalogueError("");
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogueError(
            error instanceof Error ? error.message : "Unable to load the catalogue."
          );
        }
      } finally {
        if (!cancelled) setCatalogueLoading(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [marketCode]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(cartStorageKey(marketCode));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const restored = parsed.filter(
            (item): item is CartItem =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.image === "string" &&
              typeof item.emoji === "string" &&
              Number.isFinite(Number(item.price)) &&
              Number.isInteger(Number(item.qty)) &&
              Number(item.qty) > 0
          );
          setCart(restored.map((item) => ({ ...item, qty: Number(item.qty), price: Number(item.price) })));
        }
      }
    } catch {
      window.localStorage.removeItem(cartStorageKey(marketCode));
    } finally {
      setCartHydrated(true);
    }
  }, [marketCode]);

  useEffect(() => {
    if (!cartHydrated) return;

    window.localStorage.setItem(cartStorageKey(marketCode), JSON.stringify(cart));

    if (cart.length === 0) {
      setVerifiedSubtotal(0);
      setPricingState("idle");
      return;
    }

    let cancelled = false;

    async function verifyCart() {
      setPricingState("checking");

      try {
        const response = await fetch("/api/storefront/cart/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketCode,
            items: cart.map((item) => ({
              id: item.id,
              qty: item.qty,
              selectedColor: item.selectedColor,
              selectedSize: item.selectedSize,
            })),
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to verify cart pricing.");
        }

        const nextCart: CartItem[] = Array.isArray(payload.lines)
          ? payload.lines.map((line: any) => ({
              id: String(line.id),
              image: String(line.image || ""),
              name: String(line.name || ""),
              emoji: String(line.emoji || ""),
              price: Number(line.unitPrice),
              qty: Number(line.qty),
              selectedColor:
                typeof line.selectedColor === "string"
                  ? line.selectedColor
                  : undefined,
              selectedSize:
                typeof line.selectedSize === "string"
                  ? line.selectedSize
                  : undefined,
            }))
          : [];

        if (!cancelled) {
          setVerifiedSubtotal(Number(payload.subtotal || 0));
          setPricingState("verified");
          setCart((current) =>
            JSON.stringify(current) === JSON.stringify(nextCart)
              ? current
              : nextCart
          );
        }
      } catch {
        if (!cancelled) {
          setVerifiedSubtotal(null);
          setPricingState("error");
        }
      }
    }

    verifyCart();

    return () => {
      cancelled = true;
    };
  }, [cart, cartHydrated, marketCode]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: "smooth" });
  const scrollToBest = () => bestRef.current?.scrollIntoView({ behavior: "smooth" });

  function browseCategory(category: string) {
    setCat(category);
    setQuery("");
    scrollToGrid();
  }

  function openSearch() {
    gridRef.current?.scrollIntoView();
    searchRef.current?.focus({ preventScroll: true });
  }

  const addToCart = (product: StorefrontProduct, qty = 1, color?: string, size?: string) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id && i.selectedColor === color && i.selectedSize === size);
      if (ex)
        return prev.map((i) =>
          i.id === product.id && i.selectedColor === color && i.selectedSize === size ? { ...i, qty: Math.min(20, i.qty + qty) } : i
        );
      return [
        ...prev,
        { id: product.id, image: product.image, name: product.name, emoji: product.emoji, price: product.price, qty: Math.min(20, qty), selectedColor: color, selectedSize: size },
      ];
    });
    showToast(`✓ ${product.name} added`);
    setCartOpen(true);
  };

  const removeFromCart = (id: string, color: string | undefined, size: string | undefined) =>
    setCart((p) => p.filter((i) => !(i.id === id && i.selectedColor === color && i.selectedSize === size)));

  const updateQty = (id: string, color: string | undefined, size: string | undefined, delta: number) =>
    setCart((p) =>
      p.map((i) =>
        i.id === id && i.selectedColor === color && i.selectedSize === size ? { ...i, qty: Math.min(20, Math.max(1, i.qty + delta)) } : i
      )
    );

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const categories = ["All", ...new Set(products.map((p) => p.category))];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = products.filter((product) => {
    if (cat !== "All" && product.category !== cat) return false;
    if (terms.length === 0) return true;
    const searchable = [product.name, product.category, product.canonicalCode, product.desc].join(" ").toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });

  const createPreviewDraftOrder = async (details: DraftOrderDetails): Promise<DraftOrderReceipt> => {
    const request = JSON.stringify({
      customerName: details.customerName.trim(),
      customerEmail: details.customerEmail.trim().toLowerCase(),
      phone: details.phone?.trim() || null,
      deliveryAddress: details.deliveryAddress,
      marketCode,
      items: cart.map((item) => ({
        id: item.id,
        qty: item.qty,
        selectedColor: item.selectedColor || null,
        selectedSize: item.selectedSize || null,
      })),
    });

    window.localStorage.removeItem("zayvi-order-idempotency-v1");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request));
    const requestFingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");

    let idempotencyKey = "";

    try {
      const saved = window.localStorage.getItem(ORDER_IDEMPOTENCY_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;

      if (
        parsed &&
        parsed.fingerprint === requestFingerprint &&
        typeof parsed.key === "string"
      ) {
        idempotencyKey = parsed.key;
      }
    } catch {
      window.localStorage.removeItem(ORDER_IDEMPOTENCY_STORAGE_KEY);
    }

    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      window.localStorage.setItem(
        ORDER_IDEMPOTENCY_STORAGE_KEY,
        JSON.stringify({
          fingerprint: requestFingerprint,
          key: idempotencyKey,
        })
      );
    }
    if (!details.customerName.trim() || !details.customerEmail.trim()) {
      throw new Error("Name and email are required.");
    }

    if (pricingState !== "verified") {
      throw new Error("Cart prices must be verified before saving an order.");
    }

    const response = await fetch("/api/storefront/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...details,
        idempotencyKey,
        marketCode,
        items: cart.map((item) => ({
          id: item.id,
          qty: item.qty,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
        })),
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Unable to create Preview draft order.");
    }

    const orderNumber = String(payload?.order?.orderNumber || "");
    const order = payload?.order;
    const subtotal = order?.subtotal ?? (details.deliveryAddress ? undefined : order?.total);
    const shippingTotal = order?.shippingTotal ?? (details.deliveryAddress ? undefined : 0);

    if (
      !orderNumber || !order?.id || order.currency !== (marketCode === "NG" ? "NGN" : "GBP") ||
      !Number.isFinite(subtotal) || !Number.isFinite(shippingTotal) || !Number.isFinite(order.total)
    ) {
      throw new Error("Could not confirm the draft order totals. Try again.");
    }

    setCart([]);
    window.localStorage.removeItem(cartStorageKey(marketCode));
    window.localStorage.removeItem(ORDER_IDEMPOTENCY_STORAGE_KEY);
    showToast(`Draft order ${orderNumber} created`);

    return {
      orderNumber,
      currency: order.currency,
      subtotal,
      shippingTotal,
      total: order.total,
    };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" }}>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#142e26] px-3 py-1 text-xs text-white">
        <span className="py-1">Zayvi Store Preview</span>
        <MarketSwitcher market={marketCode} settings={marketSettings} />
      </div>

      <Header
        market={marketCode}
        onBestSellers={scrollToBest}
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        onShopAll={() => browseCategory("All")}
        onCategory={browseCategory}
        onSearch={openSearch}
        scrolled={scrolled}
      />

      <Hero
        onShopAll={() => browseCategory("All")}
        onBestSellers={scrollToBest}
      />

      <TrustBar />

      <div ref={bestRef}>
        <BestSellers products={products} onView={(p) => setQv(p)} onAdd={addToCart} />
      </div>

      <CategoryGrid onSelect={browseCategory} />

      <section ref={gridRef} aria-labelledby="catalogue-title" className="mx-auto max-w-[1280px] scroll-mt-16 px-4 pt-8 pb-16 sm:px-6">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h2 id="catalogue-title" className="text-2xl font-semibold tracking-tight">{cat === "All" ? "All products" : cat}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: cat === c ? `2px solid ${STORE_COLOR}` : "1px solid #e5e5e5",
                  background: cat === c ? "#f0fdf4" : "#fff",
                  color: cat === c ? STORE_COLOR : "#555",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="relative block w-full sm:max-w-md">
            <span className="sr-only">Search the catalogue</span>
            <Search aria-hidden="true" size={18} className="pointer-events-none absolute top-3.5 left-3 text-[#52635b]" />
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products or product code"
              className="min-h-11 w-full rounded-lg border border-[#9eafa3] bg-white px-3 pl-9 text-base text-[#172a21]" />
          </label>
          {!catalogueLoading && !catalogueError && (terms.length > 0 || cat !== "All") && (
            <p role="status" className="text-sm text-[#52635b]">{filtered.length} {filtered.length === 1 ? "product" : "products"}</p>
          )}
        </div>

        {catalogueLoading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#777" }}>
            Loading the Zayvi catalogue...
          </div>
        ) : catalogueError ? (
          <div style={{ textAlign: "center", padding: 60, color: "#9a3412" }}>
            {catalogueError}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onView={(prod) => setQv(prod)} onAdd={addToCart} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="rounded-xl border border-[#dfe6e1] bg-white px-4 py-10 text-center text-sm text-[#52635b]">
                <p>{terms.length ? "No products match your search." : "No products are available in this selection yet."}</p>
                {(terms.length > 0 || cat !== "All") && (
                  <button type="button" onClick={() => { setCat("All"); setQuery(""); searchRef.current?.focus(); }}
                    className="mt-2 min-h-11 font-semibold text-[#215241] underline">Clear filters</button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <Newsletter />
      <Footer market={marketCode} onShopAll={() => browseCategory("All")} />

      <CartDrawer
        cart={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onQty={updateQty}
        onRemove={removeFromCart}
        onCreateDraftOrder={createPreviewDraftOrder}
        verifiedSubtotal={verifiedSubtotal}
        pricingState={pricingState}
        marketCode={marketCode}
      />

      <QuickView product={qv} open={!!qv} onClose={() => setQv(null)} onAdd={addToCart} />


      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "12px 24px", borderRadius: 40, fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: "0 8px 28px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
