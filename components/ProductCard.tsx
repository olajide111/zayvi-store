"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import Link from "next/link";

const STORE_COLOR = "#16a34a";

type Props = {
  product: Product;
  onView: (p: Product) => void;
  onAdd: (p: Product, qty?: number, color?: string) => void;
};

export default function ProductCard({ product, onView, onAdd }: Props) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: hov ? "0 16px 48px rgba(0,0,0,.12)" : "0 2px 8px rgba(0,0,0,.05)",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        transition: "all .2s ease",
      }}
    >
      <div style={{ background: "#f7f7f5", height: 240, position: "relative", overflow: "hidden" }}>
        <Link href={`/product/${product.id}`}>
          <img
            src={product.image}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: hov ? "scale(1.06)" : "scale(1)",
              transition: "transform .35s ease",
              cursor: "pointer",
            }}
          />
        </Link>
        {product.badge && (
          <span style={{ position: "absolute", top: 12, left: 12, background: "#111", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
            {product.badge}
          </span>
        )}
        {hov && (
          <button
            onClick={() => onView(product)}
            style={{
              position: "absolute",
              bottom: 14,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255,255,255,.95)",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,0,0,.12)",
            }}
          >
            Quick View
          </button>
        )}
      </div>

      <div style={{ padding: "16px 16px 18px" }}>
        <Link href={`/product/${product.id}`} style={{ textDecoration: "none" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4, lineHeight: 1.3 }}>
            {product.name}
          </div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ color: "#f59e0b", fontSize: 12 }}>★★★★★</span>
          <span style={{ fontSize: 12, color: "#999" }}>(24)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>£{product.price.toFixed(2)}</div>
          <button
            onClick={() => onAdd(product, 1, product.colors[0]?.name)}
            style={{
              background: STORE_COLOR,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
