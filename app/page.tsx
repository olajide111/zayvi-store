"use client";

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

const PAGES: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: "Last updated: March 2025\n\nZAYVI is committed to protecting your privacy. We collect name, email and shipping address only to fulfil orders. Payment is handled securely — we never store card details.\n\nWe do not sell your data. Contact hello@zayvi.store for any requests.",
  },
  returns: {
    title: "Returns Policy",
    body: "Our returns terms are being finalised and will be published before purchasing is enabled. Please check back for the policy that applies to your destination market.",
  },
  shipping: {
    title: "Shipping Information",
    body: "Shipping availability, delivery estimates and charges will be confirmed for each destination market before checkout is enabled. No delivery estimate is currently being offered.",
  },
  tracking: {
    title: "Track Your Order",
    body: "Check your email for the tracking link once your order ships. Allow 24–48 hours for tracking to update.\n\nNeed help? Email hello@zayvi.store with your order number.",
  },
  contact: {
    title: "Contact Us",
    body: "Email: hello@zayvi.store\n\nWe aim to reply within 24 hours on business days. Include your order number for the fastest help.",
  },
  faqs: {
    title: "FAQs",
    body: "The store is in preview while products, market availability, delivery terms and returns policies are being verified. Purchasing is not currently enabled.",
  },
  about: {
    title: "About ZAYVI",
    body: "Zayvi is developing a considered retail experience for travel, everyday carry and daily living. The catalogue shown here is a design preview, not a live offer for sale.",
  },
  affiliate: {
    title: "Affiliate Programme",
    body: "Earn commission by sharing ZAYVI products. Email hello@zayvi.store to apply.",
  },
};

function PageModal({ pageKey, onClose }: { pageKey: string; onClose: () => void }) {
  const p = PAGES[pageKey];
  if (!p) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1400, backdropFilter: "blur(4px)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1401, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,.3)" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff" }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{p.title}</div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #eee", background: "#fafafa", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ padding: 24 }}>
            {p.body.split("\n\n").map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: "#555", lineHeight: 1.8, marginBottom: 16, whiteSpace: "pre-line" }}>{para}</p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Home() {
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
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
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
        const response = await fetch("/api/storefront/products", {
          cache: "no-store",
        });
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
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
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
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setCartHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));

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
  }, [cart, cartHydrated]);

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

  const createPreviewDraftOrder = async (details: {
    customerName: string;
    customerEmail: string;
    phone?: string;
  }) => {
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

    if (!orderNumber) {
      throw new Error("Draft order was created without an order number.");
    }

    setCart([]);
    window.localStorage.removeItem(CART_STORAGE_KEY);
    showToast(`Draft order ${orderNumber} created`);

    return { orderNumber };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" }}>
      <div style={{ background: "#111", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 12, letterSpacing: 0.3 }}>
        ZAYVI STORE PREVIEW &nbsp;·&nbsp; Product range and market availability are being verified
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
      <Footer onPage={setPage} onShopAll={() => { setCat("All"); scrollToGrid(); }} />

      <CartDrawer
        cart={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onQty={updateQty}
        onRemove={removeFromCart}
        onCreateDraftOrder={createPreviewDraftOrder}
        verifiedSubtotal={verifiedSubtotal}
        pricingState={pricingState}
      />

      <QuickView product={qv} open={!!qv} onClose={() => setQv(null)} onAdd={addToCart} />

      {page && <PageModal pageKey={page} onClose={() => setPage(null)} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "12px 24px", borderRadius: 40, fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: "0 8px 28px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
