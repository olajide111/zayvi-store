export default function TrustBar() {
  const items = [
    { icon: "🚚", title: "Free Shipping", sub: "Worldwide" },
    { icon: "🔄", title: "30-Day Returns", sub: "Hassle-free" },
    { icon: "🔒", title: "Secure Checkout", sub: "PayPal protected" },
    { icon: "💬", title: "Fast Support", sub: "Always here to help" },
  ];

  return (
    <div
      style={{
        borderTop: "1px solid #eee",
        borderBottom: "1px solid #eee",
        background: "#fff",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "28px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        {items.map((item) => (
          <div key={item.title} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{item.title}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{item.sub}</div>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 640px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
