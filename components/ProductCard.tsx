"use client";

import { useState } from "react";
import type { StorefrontProduct } from "@/lib/storefront-products";
import Link from "next/link";
import { productPath } from "@/lib/storefront-market";

const STORE_COLOR = "#16a34a";

type Props = {
  product: StorefrontProduct;
  onView: (p: StorefrontProduct) => void;
  onAdd: (p: StorefrontProduct, qty?: number, color?: string, size?: string) => void;
};

export default function ProductCard({ product, onView, onAdd }: Props) {
  const [hov, setHov] = useState(false);
  const productHref = productPath(product.id, product.marketCode);
  const currency = product.currency || (product.marketCode === "NG" ? "NGN" : "GBP");
  const formattedPrice = new Intl.NumberFormat(
    product.marketCode === "NG" ? "en-NG" : "en-GB",
    {
      style: "currency",
      currency,
    }
  ).format(Number(product.price));

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
        <Link href={productHref}>
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
        {false && product.badge && (
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
        <Link href={productHref} style={{ textDecoration: "none" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4, lineHeight: 1.3 }}>
            {product.name}
          </div>
        </Link>
        <p style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>Preview catalogue · Not yet available to purchase</p>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>{formattedPrice}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: "#777" }}>
            Preview {product.marketCode === "NG" ? "NG" : "GB"} price
          </div>
          <button
            title="Add this product to your Preview cart"
            onClick={() => onAdd(product, 1, product.colors[0]?.name, product.sizes[0])}
            style={{
              background: "#17251e",
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
