"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  StorefrontProduct,
  StorefrontProductsResponse,
} from "@/lib/storefront-products";

const STORE_COLOR = "#16a34a";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const [product, setProduct] = useState<StorefrontProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [colorIdx, setColorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const response = await fetch("/api/storefront/products", {
          cache: "no-store",
        });
        const payload = (await response.json()) as StorefrontProductsResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load product.");
        }

        const found = payload.products.find((item) => item.id === id) || null;

        if (!cancelled) {
          setProduct(found);
          setError(found ? "" : "Product not found.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load product.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id) loadProduct();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#777" }}>
        Loading product...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>{error || "Product not found"}</h1>
        <Link href="/" style={{ color: STORE_COLOR, fontWeight: 600 }}>← Back to shop</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ background: "#111", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 12 }}>
        ZAYVI STORE PREVIEW · Product data loaded from PostgreSQL
      </div>

      <header style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ fontSize: 22, fontWeight: 900, color: "#111", textDecoration: "none" }}>
          ZAYVI<span style={{ color: STORE_COLOR }}>.</span>
        </Link>
        <Link href="/" style={{ fontSize: 14, color: "#555", textDecoration: "none" }}>← Continue shopping</Link>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", aspectRatio: "1", boxShadow: "0 4px 24px rgba(0,0,0,.06)" }}>
          {product.image ? (
            <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 }}>
              {product.emoji || "◇"}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>{product.category}</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 8, lineHeight: 1.2 }}>{product.name}</h1>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#111", marginBottom: 8 }}>£{Number(product.price).toFixed(2)}</div>
          <p style={{ fontSize: 12, color: "#777", marginBottom: 20 }}>
            Preview GB price · Purchasing is not enabled yet
          </p>
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, marginBottom: 24 }}>
            {product.longDesc || product.desc}
          </p>

          {product.colors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Colour: {product.colors[colorIdx]?.name}</div>
              <div style={{ display: "flex", gap: 10 }}>
                {product.colors.map((colour, index) => (
                  <button
                    key={colour.name}
                    onClick={() => setColorIdx(index)}
                    title={colour.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: colour.hex,
                      border: colorIdx === index ? "2px solid #111" : "2px solid transparent",
                      outline: colorIdx === index ? "2px solid #111" : "none",
                      outlineOffset: 2,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {product.sizes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Size</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.sizes.map((size, index) => (
                  <button
                    key={size}
                    onClick={() => setSizeIdx(index)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: sizeIdx === index ? `2px solid ${STORE_COLOR}` : "1px solid #ddd",
                      background: sizeIdx === index ? "#f0fdf4" : "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginBottom: 28, alignItems: "center" }}>
            <div style={{ display: "flex", border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 40, height: 44, border: "none", background: "#fafafa", cursor: "pointer", fontSize: 18 }}>−</button>
              <span style={{ width: 44, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{qty}</span>
              <button onClick={() => setQty(qty + 1)} style={{ width: 40, height: 44, border: "none", background: "#fafafa", cursor: "pointer", fontSize: 18 }}>+</button>
            </div>
            <button
              disabled
              aria-disabled="true"
              style={{
                flex: 1,
                background: "#e8e7e2",
                color: "#777",
                border: "none",
                borderRadius: 12,
                padding: "14px 24px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "not-allowed",
              }}
            >
              Coming soon
            </button>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #eee" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Key features</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#555", fontSize: 14, lineHeight: 1.8 }}>
              {product.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 20, fontSize: 13, color: "#888" }}>
            Availability status: {product.availabilityStatus.replaceAll("_", " ")}. Delivery and returns information will be shown before checkout is enabled.
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
