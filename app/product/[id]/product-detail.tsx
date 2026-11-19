"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cartStorageKey, marketPath } from "@/lib/storefront-market";
import type { ContentMarket } from "@/lib/storefront-content";
import type {
  StorefrontProduct,
  StorefrontProductsResponse,
} from "@/lib/storefront-products";

const STORE_COLOR = "#16a34a";

export default function ProductDetails({ id, market }: { id: string; market: ContentMarket }) {
  const shopHref = marketPath("/", market);
  const currency = market === "NG" ? "NGN" : "GBP";
  const [product, setProduct] = useState<StorefrontProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [colorIdx, setColorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const response = await fetch(`/api/storefront/products?market=${market}`, {
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
  }, [id, market]);

  const addToPreviewCart = () => {
    if (!product) return;

    try {
      const raw = window.localStorage.getItem(cartStorageKey(market));
      const existing = raw ? JSON.parse(raw) : [];
      const cart = Array.isArray(existing) ? existing : [];
      const selectedColor = product.colors[colorIdx]?.name;
      const match = cart.find(
        (item: any) =>
          item?.id === product.id && item?.selectedColor === selectedColor && item?.selectedSize === product.sizes[sizeIdx]
      );

      if (match) {
        match.qty = Math.min(20, Number(match.qty || 0) + qty);
        match.price = product.price;
        match.name = product.name;
        match.image = product.image;
        match.emoji = product.emoji;
      } else {
        cart.push({
          id: product.id,
          image: product.image,
          name: product.name,
          emoji: product.emoji,
          price: product.price,
          qty,
          selectedColor,
          selectedSize: product.sizes[sizeIdx],
        });
      }

      window.localStorage.setItem(cartStorageKey(market), JSON.stringify(cart));
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    } catch {
      setAdded(false);
    }
  };

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
        <Link href={shopHref} style={{ color: STORE_COLOR, fontWeight: 600 }}>← Back to shop</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ background: "#111", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 12 }}>
        ZAYVI STORE PREVIEW · Product data loaded from PostgreSQL
      </div>

      <header style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href={shopHref} style={{ fontSize: 22, fontWeight: 900, color: "#111", textDecoration: "none" }}>
          ZAYVI<span style={{ color: STORE_COLOR }}>.</span>
        </Link>
        <Link href={shopHref} style={{ fontSize: 14, color: "#555", textDecoration: "none" }}>← Continue shopping</Link>
      </header>

      <div className="mx-auto grid max-w-[1100px] gap-6 px-4 py-6 sm:grid-cols-2 sm:gap-12 sm:px-6 sm:py-10">
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
          <div style={{ fontSize: 26, fontWeight: 800, color: "#111", marginBottom: 8 }}>{new Intl.NumberFormat(market === "NG" ? "en-NG" : "en-GB", { style: "currency", currency }).format(product.price)}</div>
          <p style={{ fontSize: 12, color: "#777", marginBottom: 20 }}>
            Preview {market} price · Purchasing is not enabled yet
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
              <button onClick={() => setQty(Math.min(20, qty + 1))} style={{ width: 40, height: 44, border: "none", background: "#fafafa", cursor: "pointer", fontSize: 18 }}>+</button>
            </div>
            <button
              onClick={addToPreviewCart}
              style={{
                flex: 1,
                background: "#17251e",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "14px 24px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {added ? "Added to cart" : "Add to preview cart"}
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
