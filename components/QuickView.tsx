"use client";

import { useState, useEffect } from "react";
import type { Product } from "@/lib/products";
import Link from "next/link";

const STORE_COLOR = "#16a34a";

type Props = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdd: (p: Product, qty: number, color?: string) => void;
};

export default function QuickView({ product, open, onClose, onAdd }: Props) {
  const [qty, setQty] = useState(1);
  const [col, setCol] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (open) {
      setQty(1);
      setCol(0);
      setAdded(false);
    }
  }, [open, product]);

  if (!product) return null;

  const handleAdd = () => {
    onAdd(product, qty, product.colors[col]?.name);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.55)",
          zIndex: 1200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "all" : "none",
          transition: "opacity .3s",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1201,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          pointerEvents: open ? "all" : "none",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            width: "100%",
            maxWidth: 860,
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 32px 80px rgba(0,0,0,.25)",
            transform: open ? "scale(1)" : "scale(.96)",
            opacity: open ? 1 : 0,
            transition: "all .3s ease",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          <div style={{ background: "#f7f7f5", minHeight: 360 }}>
            <img
              src={product.image}
              alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div style={{ padding: 28, display: "flex", flexDirection: "column" }}>
            <button
              onClick={onClose}
              style={{
                alignSelf: "flex-end",
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #eee",
                background: "#fafafa",
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              ✕
            </button>

            {product.badge && (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#111", color: "#fff", padding: "3px 10px", borderRadius: 20, alignSelf: "flex-start", marginBottom: 8 }}>
                {product.badge}
              </span>
            )}
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{product.name}</h2>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>£{product.price.toFixed(2)}</div>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>{product.desc}</p>

            {product.colors.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Colour</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {product.colors.map((c, i) => (
                    <button
                      key={c.name}
                      onClick={() => setCol(i)}
                      title={c.name}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: c.hex,
                        border: col === i ? "2px solid #111" : "2px solid transparent",
                        outline: col === i ? "2px solid #111" : "none",
                        outlineOffset: 2,
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
              <div style={{ display: "flex", border: "1px solid #ddd", borderRadius: 10 }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 36, height: 40, border: "none", background: "none", cursor: "pointer" }}>−</button>
                <span style={{ width: 36, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{qty}</span>
                <button onClick={() => setQty(qty + 1)} style={{ width: 36, height: 40, border: "none", background: "none", cursor: "pointer" }}>+</button>
              </div>
              <button
                onClick={handleAdd}
                style={{
                  flex: 1,
                  background: added ? "#111" : STORE_COLOR,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {added ? "✓ Added" : "Add to cart"}
              </button>
            </div>

            <Link
              href={`/product/${product.id}`}
              onClick={onClose}
              style={{
                marginTop: 14,
                textAlign: "center",
                fontSize: 13,
                color: STORE_COLOR,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View full details →
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
