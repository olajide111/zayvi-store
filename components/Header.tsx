"use client";

import { useState } from "react";

const STORE_NAME = "ZAYVI";
const STORE_COLOR = "#16a34a";

type Props = {
  cartCount: number;
  onCartOpen: () => void;
  onShopAll: () => void;
  onCategory: (cat: string) => void;
  scrolled: boolean;
};

export default function Header({ cartCount, onCartOpen, onShopAll, onCategory, scrolled }: Props) {
  const [megaOn, setMegaOn] = useState(false);
  const cats = ["Travel", "Beauty", "Home", "Fitness", "Pets", "Accessories", "Health"];

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 900,
        background: "#fff",
        borderBottom: "1px solid #efefef",
        boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,.07)" : "none",
        transition: "box-shadow .2s",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div
          onClick={onShopAll}
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "#111",
            letterSpacing: -0.5,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {STORE_NAME}
          <span style={{ color: STORE_COLOR }}>.</span>
        </div>

        <div
          style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" }}
          onMouseLeave={() => setMegaOn(false)}
        >
          <div style={{ position: "relative" }} onMouseEnter={() => setMegaOn(true)}>
            <button
              onClick={onShopAll}
              style={{
                padding: "8px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "#444",
                borderRadius: 6,
              }}
            >
              Shop <span style={{ fontSize: 9 }}>▾</span>
            </button>
            {megaOn && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#fff",
                  borderRadius: 16,
                  boxShadow: "0 20px 60px rgba(0,0,0,.14)",
                  border: "1px solid #f0f0f0",
                  padding: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  zIndex: 200,
                  marginTop: 8,
                  minWidth: 280,
                }}
              >
                {cats.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      onCategory(c);
                      setMegaOn(false);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#555",
                      fontWeight: 500,
                      borderRadius: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onShopAll}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#444",
            }}
          >
            New In
          </button>
          <button
            onClick={onShopAll}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#444",
            }}
          >
            Best Sellers
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onCartOpen}
            style={{
              position: "relative",
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: "#f5f5f5",
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            🛒
            {cartCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  background: STORE_COLOR,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
