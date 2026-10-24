"use client";

import type { Product } from "@/lib/products";
import ProductCard from "./ProductCard";

type Props = {
  products: Product[];
  onView: (p: Product) => void;
  onAdd: (p: Product, qty?: number, color?: string) => void;
};

export default function BestSellers({ products, onView, onAdd }: Props) {
  const bestsellers = products.filter((p) => p.badge === "Best Seller").slice(0, 4);

  if (bestsellers.length === 0) return null;

  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 4 }}>Best Sellers</h2>
          <p style={{ fontSize: 14, color: "#666" }}>What people keep coming back for</p>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 20,
        }}
      >
        {bestsellers.map((p) => (
          <ProductCard key={p.id} product={p} onView={onView} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}
