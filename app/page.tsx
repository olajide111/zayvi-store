"use client";

import { useState, useEffect } from "react";
import { PRODUCTS } from "@/lib/products";
import Header from "@/components/Header";
import TrustBar from "@/components/TrustBar";
import CartDrawer, { type CartItem } from "@/components/CartDrawer";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";

const STORE_COLOR = "#16a34a";
const BOTTLE = PRODUCTS.find((p) => p.id === 1)!;

const PAGES: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: "Last updated: March 2025\n\nZAYVI is committed to protecting your privacy. We collect name, email and shipping address only to fulfil orders. Payment is handled securely — we never store card details.\n\nWe do not sell your data. Contact hello@zayvi.store for any requests.",
  },
  returns: {
    title: "Returns Policy",
    body: "30-day returns on unused items in original packaging.\n\nEmail hello@zayvi.store with your order number. Damaged items: send a photo within 7 days for replacement or refund.\n\nRefunds processed within 5 business days of receiving the return.",
  },
  shipping: {
    title: "Shipping Information",
    body: "FREE shipping on every order.\n\nUK: 5–10 business days\nEurope: 7–14 business days\nRest of world: 10–21 business days\n\nTracking link sent by email once dispatched.",
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
    body: "UK delivery usually takes 5–10 business days.\n\nYes — free shipping on every order.\n\n30-day returns on unused items. Payments are securely processed via PayPal or card.",
  },
  about: {
    title: "About ZAYVI",
    body: "ZAYVI makes one bottle that actually works — stays cold, looks good, no clutter.\n\nFree shipping. 30-day returns. Straightforward.",
  },
  affiliate: {
    title: "Affiliate Programme",
    body: "Earn commission by sharing the AeroBottle. Email hello@zayvi.store to apply.",
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
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState<string | null>(null);
  const [color, setColor] = useState(BOTTLE.colors[0].name);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const addBottle = () => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === BOTTLE.id && i.selectedColor === color);
      if (ex) return prev.map((i) => (i.id === BOTTLE.id && i.selectedColor === color ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id: BOTTLE.id, name: BOTTLE.name, emoji: BOTTLE.emoji, price: BOTTLE.price, qty: 1, selectedColor: color }];
    });
    showToast("✓ AeroBottle added");
    setCartOpen(true);
  };

  const removeFromCart = (id: number, col: string | undefined) =>
    setCart((p) => p.filter((i) => !(i.id === id && i.selectedColor === col)));

  const updateQty = (id: number, col: string | undefined, delta: number) =>
    setCart((p) =>
      p.map((i) => (i.id === id && i.selectedColor === col ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
    );

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);

  const handlePayPal = async () => {
    try {
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.map((i) => ({ id: i.id, qty: i.qty })) }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else showToast("PayPal checkout unavailable");
    } catch {
      showToast("Checkout failed — try again");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" }}>
      <div style={{ background: "#111", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 12, letterSpacing: 0.3 }}>
        FREE Shipping &nbsp;•&nbsp; 30-Day Returns &nbsp;•&nbsp; Secure Checkout
      </div>

      <Header
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        onShopAll={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onCategory={() => {}}
        scrolled={scrolled}
      />

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-block", background: "#f0fdf4", color: STORE_COLOR, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 20, marginBottom: 16 }}>
            BEST SELLER
          </div>
          <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, marginBottom: 12 }}>
            The bottle that<br />stays cold all day.
          </h1>
          <p style={{ fontSize: 17, color: "#555", lineHeight: 1.6, marginBottom: 24, maxWidth: 420 }}>
            Double-wall insulated steel. 24 hours cold, 12 hours hot. Leak-proof. Looks good on your desk and in your bag.
          </p>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Colour</div>
            <div style={{ display: "flex", gap: 8 }}>
              {BOTTLE.colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: c.hex,
                    border: color === c.name ? "3px solid #111" : "2px solid #ddd",
                    cursor: "pointer",
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>£{BOTTLE.price.toFixed(0)}</div>
            <div style={{ fontSize: 13, color: "#666" }}>Free shipping</div>
          </div>

          <button
            onClick={addBottle}
            style={{
              background: STORE_COLOR,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "16px 32px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              maxWidth: 320,
            }}
          >
            Add to Cart — £{BOTTLE.price.toFixed(0)}
          </button>

          <div style={{ display: "flex", gap: 20, marginTop: 20, fontSize: 13, color: "#666" }}>
            <span>✓ 30-day returns</span>
            <span>✓ Secure checkout</span>
          </div>
        </div>

        <div style={{ borderRadius: 20, overflow: "hidden", background: "#f0f0ec", aspectRatio: "1/1", boxShadow: "0 20px 50px rgba(0,0,0,.08)" }}>
          <img src={BOTTLE.image} alt="AeroBottle" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </section>

      <TrustBar />

      {/* Benefits */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 36 }}>Why people keep it</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 28 }}>
          {[
            { t: "Stays cold 24 hours", d: "Ice water in the morning is still cold at night." },
            { t: "Stays hot 12 hours", d: "Coffee stays drinkable from commute to lunch." },
            { t: "Leak-proof", d: "Goes in your bag without worrying about the laptop." },
            { t: "Looks good", d: "Soft-touch finish that doesn’t scream gym bottle." },
          ].map((b) => (
            <div key={b.t} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{b.t}</div>
              <div style={{ fontSize: 14, color: "#555", lineHeight: 1.5 }}>{b.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Proof */}
      <div style={{ background: "#fff", padding: "48px 24px", textAlign: "center", borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
        <p style={{ fontSize: 17, color: "#333", maxWidth: 520, margin: "0 auto 12px", lineHeight: 1.6 }}>
          “Finally a bottle that doesn’t leak in my bag and still looks decent on my desk.”
        </p>
        <p style={{ fontSize: 13, color: "#888" }}>— Verified buyer, UK</p>
      </div>

      {/* Specs */}
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "56px 24px" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Details</h2>
        <ul style={{ listStyle: "none", padding: 0, fontSize: 15, color: "#444", lineHeight: 1.9 }}>
          {BOTTLE.features.map((f) => (
            <li key={f}>• {f}</li>
          ))}
          <li>• 750ml capacity</li>
          <li>• Soft-touch powder coat</li>
          <li>• Fits most cup holders</li>
        </ul>
      </section>

      {/* Final CTA */}
      <section style={{ background: "#111", color: "#fff", textAlign: "center", padding: "64px 24px" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Get the AeroBottle</h2>
        <p style={{ fontSize: 16, color: "#ccc", marginBottom: 24 }}>£{BOTTLE.price.toFixed(0)} · Free shipping · 30-day returns</p>
        <button
          onClick={addBottle}
          style={{
            background: STORE_COLOR,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "16px 36px",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Add to Cart
        </button>
      </section>

      <Newsletter />
      <Footer onPage={setPage} onShopAll={() => window.scrollTo({ top: 0, behavior: "smooth" })} />

      <CartDrawer
        cart={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onQty={updateQty}
        onRemove={removeFromCart}
        onCheckout={handlePayPal}
      />

      {page && <PageModal pageKey={page} onClose={() => setPage(null)} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "12px 24px", borderRadius: 40, fontSize: 13, fontWeight: 700, zIndex: 9999 }}>
          {toast}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          section[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
            padding: 32px 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
