"use client";

type Props = {
  onPage: (key: string) => void;
  onShopAll: () => void;
};

export default function Footer({ onPage, onShopAll }: Props) {
  const cols = [
    {
      title: "Shop",
      items: [
        { label: "All Products", action: onShopAll },
        { label: "New In", action: onShopAll },
        { label: "Best Sellers", action: onShopAll },
        { label: "Travel", action: onShopAll },
        { label: "Beauty", action: onShopAll },
      ],
    },
    {
      title: "Help",
      items: [
        { label: "Shipping & Returns", action: () => onPage("shipping") },
        { label: "FAQs", action: () => onPage("faqs") },
        { label: "Order Tracking", action: () => onPage("tracking") },
        { label: "Contact Us", action: () => onPage("contact") },
      ],
    },
    {
      title: "Company",
      items: [
        { label: "About Us", action: () => onPage("about") },
        { label: "Privacy", action: () => onPage("privacy") },
        { label: "Returns Policy", action: () => onPage("returns") },
        { label: "Affiliate", action: () => onPage("affiliate") },
      ],
    },
  ];

  return (
    <footer style={{ background: "#fff", borderTop: "1px solid #eee", padding: "48px 24px 32px" }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 32,
        }}
      >
        {cols.map((col) => (
          <div key={col.title}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#111", marginBottom: 14 }}>
              {col.title}
            </div>
            {col.items.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={
                  {
                    display: "block",
                    background: "none",
                    border: "none",
                    padding: "4px 0",
                    fontSize: 13,
                    color: "#666",
                    cursor: "pointer",
                    textAlign: "left",
                  }
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#111", marginBottom: 14 }}>
            Follow Us
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 18 }}>
            <span style={{ cursor: "pointer" }}>📷</span>
            <span style={{ cursor: "pointer" }}>📘</span>
            <span style={{ cursor: "pointer" }}>▶️</span>
            <span style={{ cursor: "pointer" }}>🎵</span>
          </div>
        </div>
      </div>
      <div
        style={{
          maxWidth: 1100,
          margin: "32px auto 0",
          paddingTop: 24,
          borderTop: "1px solid #f0f0f0",
          fontSize: 12,
          color: "#999",
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} ZAYVI. All rights reserved.
      </div>
    </footer>
  );
}
