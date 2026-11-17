"use client";

import type { DraftOrderDetails, DraftOrderReceipt } from "@/lib/delivery";
import { useState, useEffect, useRef } from "react";
import type { StorefrontProduct, StorefrontProductsResponse } from "@/lib/storefront-products";
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
const CART_STORAGE_KEY = "zayvi-cart-v2";
const ORDER_IDEMPOTENCY_STORAGE_KEY = "zayvi-order-idempotency-v2";

export default function Home() {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [marketCode, setMarketCode] = useState<"GB" | "NG">("GB");
  const [marketReady, setMarketReady] = useState(false);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [verifiedSubtotal, setVerifiedSubtotal] = useState<number | null>(null);
  const [pricingState, setPricingState] = useState<"idle" | "checking" | "verified" | "error">("idle");
  const [cartOpen, setCartOpen] = useState(false);
  const [qv, setQv] = useState<StorefrontProduct | null>(null);
  const [cat, setCat] = useState("All");
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const bestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search)
      .get("market")
      ?.toUpperCase();
    setMarketCode(requested === "NG" ? "NG" : "GB");
    setMarketReady(true);
  }, []);

  useEffect(() => {
    if (!marketReady) return;

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
  }, [marketCode, marketReady]);

  useEffect(() => {
    if (!marketReady) return;
    setCartHydrated(false);
    setCart([]);
    try {
      const raw = window.localStorage.getItem(`${CART_STORAGE_KEY}-${marketCode}`);
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
      window.localStorage.removeItem(`${CART_STORAGE_KEY}-${marketCode}`);
    } finally {
      setCartHydrated(true);
    }
  }, [marketCode, marketReady]);

  useEffect(() => {
    if (!cartHydrated || !marketReady) return;

    window.localStorage.setItem(`${CART_STORAGE_KEY}-${marketCode}`, JSON.stringify(cart));

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
  }, [cart, cartHydrated, marketCode, marketReady]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: "smooth" });
  const scrollToBest = () => bestRef.current?.scrollIntoView({ behavior: "smooth" });

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
  const filtered =
    cat === "All" ? products : products.filter((p) => p.category === cat);

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
    window.localStorage.removeItem(`${CART_STORAGE_KEY}-${marketCode}`);
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
      <div style={{ background: "#111", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 12, letterSpacing: 0.3 }}>
        ZAYVI STORE PREVIEW &nbsp;·&nbsp; {marketCode === "NG" ? "Nigeria · NGN" : "United Kingdom · GBP"} &nbsp;·&nbsp; Product range and market availability are being verified
      </div>

      <Header
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        onShopAll={() => { setCat("All"); scrollToGrid(); }}
        onCategory={(c) => { setCat(c); scrollToGrid(); }}
        scrolled={scrolled}
      />

      <Hero
        onShopAll={() => { setCat("All"); scrollToGrid(); }}
        onBestSellers={scrollToBest}
      />

      <TrustBar />

      <div ref={bestRef}>
        <BestSellers products={products} onView={(p) => setQv(p)} onAdd={addToCart} />
      </div>

      <CategoryGrid onSelect={(c) => { setCat(c); scrollToGrid(); }} />

      <section ref={gridRef} style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{cat === "All" ? "All Products" : cat}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <button
                key={c}
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
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
                No products in this category yet.
              </div>
            )}
          </>
        )}
      </section>

      <Newsletter />
      <Footer market={marketCode} onShopAll={() => { setCat("All"); scrollToGrid(); }} />

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
