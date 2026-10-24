"use client";

const STORE_COLOR = "#16a34a";

type Props = {
  onShopAll: () => void;
  onBestSellers: () => void;
};

export default function Hero({ onShopAll, onBestSellers }: Props) {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "40px 24px 32px",
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr",
        gap: 40,
        alignItems: "center",
      }}
    >
      <div>
        <div
          style={{
            display: "inline-block",
            background: "#f0fdf4",
            color: STORE_COLOR,
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 20,
            marginBottom: 16,
            letterSpacing: 0.3,
          }}
        >
          TRAVEL & DAILY ESSENTIALS
        </div>
        <h1
          style={{
            fontSize: "clamp(2.2rem, 4.5vw, 3.3rem)",
            fontWeight: 800,
            lineHeight: 1.12,
            color: "#111",
            letterSpacing: -1.2,
            marginBottom: 14,
          }}
        >
          Pack light.
          <br />
          Live better.
        </h1>
        <p style={{ fontSize: 16, color: "#555", lineHeight: 1.65, marginBottom: 24, maxWidth: 420 }}>
          Travel gear and daily tools that actually earn their place — no filler, free shipping, 30-day returns.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={onBestSellers}
            style={{
              background: STORE_COLOR,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "14px 26px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Shop Best Sellers
          </button>
          <button
            onClick={onShopAll}
            style={{
              background: "transparent",
              color: "#111",
              border: "2px solid #111",
              borderRadius: 10,
              padding: "12px 24px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            View all
          </button>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 28, fontSize: 13, color: "#666" }}>
          <span>✓ Free shipping</span>
          <span>✓ 30-day returns</span>
          <span>✓ Secure checkout</span>
        </div>
      </div>

      <div
        style={{
          borderRadius: 20,
          overflow: "hidden",
          background: "#f0f0ec",
          aspectRatio: "4/3",
          boxShadow: "0 20px 50px rgba(0,0,0,.08)",
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=900&q=80"
          alt="Travel and daily essentials"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <style>{`
        @media (max-width: 768px) {
          section { grid-template-columns: 1fr !important; padding: 28px 20px !important; }
        }
      `}</style>
    </section>
  );
}
