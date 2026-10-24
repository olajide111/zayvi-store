"use client";

import { useState, useEffect, useRef } from "react";
import { PRODUCTS } from "@/lib/products";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import CategoryGrid from "@/components/CategoryGrid";
import ProductCard from "@/components/ProductCard";
import CartDrawer, { type CartItem } from "@/components/CartDrawer";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";

const STORE_COLOR = "#16a34a";

const PAGES: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: "Last updated: March 2025\n\nZAYVI is committed to protecting your privacy. We collect name, email and shipping address only to fulfil orders. Payment is handled by PayPal — we never store card details.\n\nWe do not sell your data. Contact hello@zayvi.store for any requests.",
  },
  returns: {
    title: "Returns Policy",
    body: "30-day returns on unused items in original packaging.\n\nEmail hello@zayvi.store with your order number. Damaged items: send a photo within 7 days for replacement or refund.\n\nRefunds processed within 5 business days of receiving the return.",
  },
  shipping: {
    title: "Shipping Information",
    body: "FREE worldwide shipping on every order.\n\nUK: 7–14 business days\nUS & Europe: 8–16 business days\nRest of world: 12–21 business days\n\nTracking link sent by email once dispatched.",
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
    body: "Delivery usually takes 7–14 days in the UK and 10–21 days internationally.\n\nYes, free worldwide shipping on every order.\n\n30-day returns on unused items. Payments are securely processed by PayPal.",
  },
  about: {
    title: "About ZAYVI",
    body: "ZAYVI curates everyday essentials that feel a little elevated. We focus on useful, well-designed products with free worldwide shipping and straightforward returns.\n\nThank you for shopping with us.",
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
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.55)",
          zIndex: 1400,
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        style={
          {
            position: "fixed",
            inset: 0,
            zIndex: 1401,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }
        }
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            width: "100%",
            maxWidth: 560,
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 32px 80px rgba(0,0,0,.3)",
          }}
        >
          <div
            style={
              {
                padding: "20px 24px",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                top: 0,
                background: "#fff",
              }
            }
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>{p.title}</div>
            <button
              onClick={onClose}
              style={
                {
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "1px solid #eee",
                  background: "#fafafa",
                  cursor: "pointer",
                }
              }
            >
              ✕
            </button>
          </div>
          <div style={{ padding: 24 }}>
            {p.body.split("\n\n").map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 14,
                  color: "#555",
                  lineHeight: 1.8,
                  marginBottom: 16,
                  whiteSpace: "pre-line",
                }}
              >
                {para}
              </p>
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
  const [cat, setCat] = useState("All");
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  const addToCart = (product: (typeof PRODUCTS)[0], qty = 1, color?: string) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id && i.selectedColor === color);
      if (ex)
        return prev.map((i) =>
          i.id === product.id && i.selectedColor === color ? { ...i, qty: i.qty + qty } : i
        );
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          emoji: product.emoji,
          price: product.price,
          qty,
          selectedColor: color,
        },
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
        i.id === id && i.selectedColor === color
          ? { ...i, qty: Math.max(1, i.qty + delta) }
          : i
      )
    );

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);

  const filtered =
    cat === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat);

  const handleCheckout = async () => {
    try {
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({ id: i.id, qty: i.qty })),
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else showToast("Checkout unavailable right now");
    } catch {
      showToast("Checkout failed — try again");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f8f6",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111",
      }}
    >
      {/* Announcement bar */}
      <div
        style={{
          background: "#111",
          color: "#fff",
          textAlign: "center",
          padding: "10px 16px",
          fontSize: 12,
          letterSpacing: 0.3,
        }}
      >
        FREE Worldwide Shipping on Every Order &nbsp;•&nbsp; 30-Day Returns &nbsp;•&nbsp; Secure
        PayPal Checkout
      </div>

      <Header
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        onShopAll={() => {
          setCat("All");
          scrollToGrid();
        }}
        onCategory={(c) => {
          setCat(c);
          scrollToGrid();
        }}
        scrolled={scrolled}
      />

      <Hero
        onShopAll={() => {
          setCat("All");
          scrollToGrid();
        }}
      />

      <TrustBar />

      <CategoryGrid
        onSelect={(c) => {
          setCat(c);
          scrollToGrid();
        }}
      />

      {/* Product grid */}
      <section ref={gridRef} style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>
            {cat === "All" ? "Trending Now" : cat}
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["All", "Travel", "Beauty", "Fitness", "Pets", "Accessories", "Health"].map((c) => (
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onView={() => {}}
              onAdd={addToCart}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
            No products in this category yet.
          </div>
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
        onCheckout={handleCheckout}
      />

      {page && <PageModal pageKey={page} onClose={() => setPage(null)} />}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 40,
            fontSize: 13,
            fontWeight: 700,
            zIndex: 9999,
            boxShadow: "0 8px 28px rgba(0,0,0,.2)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
