"use client";

type Props = {
  onSelect: (cat: string) => void;
};

const CATS = [
  { name: "Travel", image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80" },
  { name: "Beauty", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80" },
  { name: "Home", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&q=80" },
  { name: "Fitness", image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80" },
  { name: "Pets", image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&q=80" },
  { name: "Accessories", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80" },
];

export default function CategoryGrid({ onSelect }: Props) {
  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 24px 24px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 20 }}>
        Shop by Category
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
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
            <div style={{ height: 110, overflow: "hidden" }}>
              <img
                src={c.image}
                alt={c.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#111" }}>
              {c.name}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
