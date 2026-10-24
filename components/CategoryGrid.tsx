"use client";

type Props = {
  onSelect: (cat: string) => void;
};

const CATS = [
  { name: "Travel", image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80" },
  { name: "Carry", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80" },
  { name: "Recovery", image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80" },
  { name: "Daily", image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80" },
];

export default function CategoryGrid({ onSelect }: Props) {
  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px 24px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>Shop by category</h2>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>Everything we sell earns its place.</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {CATS.map((c) => (
          <button
            key={c.name}
            onClick={() => onSelect(c.name)}
            style={{
              background: "#fff",
              border: "1px solid #eee",
              borderRadius: 16,
              overflow: "hidden",
              cursor: "pointer",
              textAlign: "left",
              padding: 0,
            }}
          >
            <div style={{ height: 120, overflow: "hidden" }}>
              <img src={c.image} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ padding: "14px 16px", fontSize: 15, fontWeight: 700, color: "#111" }}>{c.name}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
