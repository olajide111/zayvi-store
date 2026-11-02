"use client";

import { useState, useEffect, useRef } from "react";
import { PRODUCTS } from "@/lib/products";
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

const STORE_COLOR = "#16a34a";

const PAGES: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: "Last updated: March 2025\n\nZAYVI is committed to protecting your privacy. We collect name, email and shipping address only to fulfil orders. Payment is handled securely — we never store card details.\n\nWe do not sell your data. Contact hello@zayvi.store for any requests.",
  },
  returns: {
    title: "Returns Policy",
    body: "Our returns process and eligibility terms are being finalised. Please contact hello@zayvi.store before placing an order to confirm the current arrangements.",
  },
  shipping: {
    title: "Shipping Information",
    body: "Delivery availability, charges and estimated delivery dates must be confirmed before you place an order. Please contact hello@zayvi.store for current delivery information.",
  },
  tracking: {
    title: "Track Your Order",
    body: "If you have already paid through PayPal, contact hello@zayvi.store and include your PayPal order reference so we can help with your enquiry.",
  },
  contact: {
    title: "Contact Us",
    body: "Email: hello@zayvi.store\n\nWe aim to reply within 24 hours on business days. Include your order number for the fastest help.",
  },
  faqs: {
    title: "FAQs",
    body: "How much is delivery? Contact us to confirm the delivery charge for your item before ordering.\n\nWhat is your returns process? Contact us for the current returns arrangements before ordering.\n\nHow do I pay? Checkout is handled through PayPal."
  },
  about: {
    title: "About ZAYVI",
    body: "ZAYVI is focused on useful travel and everyday essentials, with a carefully selected range designed to make daily life simpler."
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [qv, setQv] = useState<(typeof PRODUCTS)[0] | null>(null);
  const [cat, setCat] = useState("All");
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const bestRef = useRef<HTMLDivElement>(null);
  const cartHydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("zayvi-cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      localStorage.removeItem("zayvi-cart");
    }
    cartHydrated.current = true;

    const syncCart = (event: Event) => {
      const customEvent = event as CustomEvent<CartItem[]>;
      if (Array.isArray(customEvent.detail)) setCart(customEvent.detail);
    };
    window.addEventListener("zayvi-cart-updated", syncCart);
    return () => window.removeEventListener("zayvi-cart-updated", syncCart);
  }, []);

  useEffect(() => {
    if (cartHydrated.current) {
      localStorage.setItem("zayvi-cart", JSON.stringify(cart));
    }
  }, [cart]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: "smooth" });
  const scrollToBest = () => bestRef.current?.scrollIntoView({ behavior: "smooth" });

  const addToCart = (product: (typeof PRODUCTS)[0], qty = 1, color?: string) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id && i.selectedColor === color);
      if (ex)
        return prev.map((i) =>
          i.id === product.id && i.selectedColor === color ? { ...i, qty: i.qty + qty } : i
        );
      return [
        ...prev,
        { id: product.id, name: product.name, emoji: product.emoji, price: product.price, qty, selectedColor: color },
      ];
    });
    showToast(`✓ ${product.name} added`);
    setCartOpen(true);
  };

  const removeFromCart = (id: number, color: string | undefined) =>
    setCart((p) => p.filter((i) => !(i.id === id && i.selectedColor === color)));

  const updateQty = (id: number, color: string | undefined, delta: number) =>
    setCart((p) =>
      p.map((i) =>
        i.id === id && i.selectedColor === color ? { ...i, qty: Math.max(1, i.qty + delta) } : i
      )
    );

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const filtered = cat === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat);

  const handlePayPal = async () => {
    if (checkoutLoading || cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.map((i) => ({ id: i.id, qty: i.qty })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "PayPal checkout is unavailable.");
      window.location.assign(data.url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Checkout failed. Please try again.");
      setCheckoutLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" }}>
      <div style={{ background: "#111", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 12, letterSpacing: 0.3 }}>
        Travel & everyday essentials &nbsp;•&nbsp; PayPal checkout &nbsp;•&nbsp; Customer support
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
        <BestSellers products={PRODUCTS} onView={(p) => setQv(p)} onAdd={addToCart} />
      </div>


      <CategoryGrid onSelect={(c) => { setCat(c); scrollToGrid(); }} />

      <section ref={gridRef} style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{cat === "All" ? "All Products" : cat}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["All", "Travel", "Carry", "Recovery", "Daily"].map((c) => (
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onView={(prod) => setQv(prod)} onAdd={addToCart} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>No products in this category yet.</div>
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
        onCheckout={handlePayPal}
        checkoutLoading={checkoutLoading}
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
