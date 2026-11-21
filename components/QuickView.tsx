"use client";

import {useModalDialog} from "@/hooks/useModalDialog";
import { useState, useEffect,useId } from "react";
import type { StorefrontProduct } from "@/lib/storefront-products";
import Link from "next/link";
import { productPath } from "@/lib/storefront-market";

const STORE_COLOR = "#215241";

type Props = {
  product: StorefrontProduct | null;
  open: boolean;
  onClose: () => void;
  onAdd: (p: StorefrontProduct, qty: number, color?: string, size?: string) => void;
};

export default function QuickView({ product, open, onClose, onAdd }: Props) {
  const dialog=useModalDialog(open && !!product,onClose),titleId=useId();
  const [imageFailed,setImageFailed]=useState(false);
  const [qty, setQty] = useState(1);
  const [col, setCol] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (open) {
      setImageFailed(false);
      setQty(1);
      setCol(0);
      setSizeIdx(0);
      setAdded(false);
    }
  }, [open, product]);

  if (!product||!open) return null;

  const handleAdd = () => {
    onAdd(product, Math.min(20, qty), product.colors[col]?.name, product.sizes[sizeIdx]);
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
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="z-original-quick-view"
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
            {!imageFailed&&product.image?<img onError={()=>setImageFailed(true)}
              src={product.image}
              alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />:<p className="p-6 text-sm">Image unavailable · {product.name}</p>}
          </div>

          <div style={{ padding: 28, display: "flex", flexDirection: "column" }}>
            <button
              onClick={onClose}
              aria-label="Close quick view"
              style={{
                alignSelf: "flex-end",
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "1px solid #eee",
                background: "#fafafa",
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              ✕
            </button>
            <h2 id={titleId} style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{product.name}</h2>
            <p style={{ fontSize: 12, color: "#777", marginBottom: 12 }}>Preview catalogue · Not yet available to purchase</p>
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

            {product.sizes.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Size</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {product.sizes.map((size, i) => (
                    <button
                      key={size}
                      onClick={() => setSizeIdx(i)}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 8,
                        border: sizeIdx === i ? "2px solid #17251e" : "1px solid #ddd",
                        background: sizeIdx === i ? "#f0fdf4" : "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
              <div style={{ display: "flex", border: "1px solid #ddd", borderRadius: 10 }}>
                <button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 36, height: 40, border: "none", background: "none", cursor: "pointer" }}>−</button>
                <span style={{ width: 36, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{qty}</span>
                <button aria-label="Increase quantity" onClick={() => setQty(Math.min(20, qty + 1))} style={{ width: 36, height: 40, border: "none", background: "none", cursor: "pointer" }}>+</button>
              </div>
              <button
                onClick={handleAdd}
                title="Add this product to your Preview cart"
                style={{
                  flex: 1,
                  background: "#17251e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {added ? "Added" : "Add to preview cart"}
              </button>
            </div>

            <Link
              href={productPath(product.id, product.marketCode)}
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
          div.z-original-quick-view {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
