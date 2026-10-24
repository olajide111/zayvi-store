"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PRODUCTS } from "@/lib/products";
import Link from "next/link";

const STORE_COLOR = "#16a34a";

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const product = PRODUCTS.find((p) => p.id === id);

  const [qty, setQty] = useState(1);
  const [colorIdx, setColorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Product not found</h1>
        <Link href="/" style={{ color: STORE_COLOR, fontWeight: 600 }}>← Back to shop</Link>
      </div>
    );
  }

  const handleAdd = () => {
    // Simple client-side cart via localStorage for now (main page also uses state)
    const cart = JSON.parse(localStorage.getItem("zayvi-cart") || "[]");
    const color = product.colors[colorIdx]?.name;
    const existing = cart.find((i: any) => i.id === product.id && i.selectedColor === color);
    if (existing) existing.qty += qty;
    else cart.push({ id: product.id, name: product.name, emoji: product.emoji, price: product.price, qty, selectedColor: color });
    localStorage.setItem("zayvi-cart", JSON.stringify(cart));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ background: "#111", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 12 }}>
        FREE Worldwide Shipping • 30-Day Returns • Secure Checkout
      </div>

      <header style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ fontSize: 22, fontWeight: 900, color: "#111", textDecoration: "none" }}>
          ZAYVI<span style={{ color: STORE_COLOR }}>.</span>
        </Link>
        <Link href="/" style={{ fontSize: 14, color: "#555", textDecoration: "none" }}>← Continue shopping</Link>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
        {/* Image */}
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", aspectRatio: "1", boxShadow: "0 4px 24px rgba(0,0,0,.06)" }}>
          <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Details */}
        <div>
          {product.badge && (
            <span style={{ display: "inline-block", background: "#111", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, marginBottom: 12 }}>
              {product.badge}
            </span>
          )}
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 8, lineHeight: 1.2 }}>{product.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ color: "#f59e0b" }}>★★★★★</span>
            <span style={{ fontSize: 13, color: "#888" }}>4.8 (124 reviews)</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#111", marginBottom: 20 }}>£{product.price.toFixed(2)}</div>
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, marginBottom: 24 }}>{product.longDesc}</p>

          {/* Colors */}
          {product.colors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Colour: {product.colors[colorIdx]?.name}</div>
              <div style={{ display: "flex", gap: 10 }}>
                {product.colors.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => setColorIdx(i)}
                    title={c.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: c.hex,
                      border: colorIdx === i ? "2px solid #111" : "2px solid transparent",
                      outline: colorIdx === i ? "2px solid #111" : "none",
                      outlineOffset: 2,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sizes */}
          {product.sizes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Size</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.sizes.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setSizeIdx(i)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: sizeIdx === i ? `2px solid ${STORE_COLOR}` : "1px solid #ddd",
                      background: sizeIdx === i ? "#f0fdf4" : "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty + Add */}
          <div style={{ display: "flex", gap: 12, marginBottom: 28, alignItems: "center" }}>
            <div style={{ display: "flex", border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 40, height: 44, border: "none", background: "#fafafa", cursor: "pointer", fontSize: 18 }}>−</button>
              <span style={{ width: 44, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{qty}</span>
              <button onClick={() => setQty(qty + 1)} style={{ width: 40, height: 44, border: "none", background: "#fafafa", cursor: "pointer", fontSize: 18 }}>+</button>
            </div>
            <button
              onClick={handleAdd}
              style={{
                flex: 1,
                background: added ? "#111" : STORE_COLOR,
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "14px 24px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {added ? "✓ Added to cart" : "Add to cart"}
            </button>
          </div>

          {/* Features */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #eee" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Key features</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#555", fontSize: 14, lineHeight: 1.8 }}>
              {product.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 20, fontSize: 13, color: "#888" }}>
            ✓ Free worldwide shipping &nbsp;•&nbsp; ✓ 30-day returns
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}
