"use client";

const STORE_COLOR = "#16a34a";

type Props = {
  onShopAll: () => void;
};

export default function Hero({ onShopAll }: Props) {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "48px 24px 40px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 48,
        alignItems: "center",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            color: "#111",
            letterSpacing: -1.5,
            marginBottom: 16,
          }}
        >
          Everyday essentials,
          <br />
          <span style={{ color: STORE_COLOR }}>elevated.</span>
        </h1>
        <p style={{ fontSize: 17, color: "#555", lineHeight: 1.6, marginBottom: 28, maxWidth: 420 }}>
          Curated products that actually make life better.
          <br />
          Free shipping worldwide.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={onShopAll}
            style={{
              background: STORE_COLOR,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Shop All Products
          </button>
          <button
            onClick={onShopAll}
            style={{
              background: "transparent",
              color: STORE_COLOR,
              border: `2px solid ${STORE_COLOR}`,
              borderRadius: 10,
              padding: "12px 26px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            New Arrivals
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 24,
          overflow: "hidden",
          background: "#f0f0ec",
          aspectRatio: "4/3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=900&q=80"
          alt="Elevated everyday essentials"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <style>{`
        @media (max-width: 768px) {
          section { grid-template-columns: 1fr !important; padding: 32px 20px !important; }
        }
      `}</style>
    </section>
  );
}
