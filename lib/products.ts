// ZAYVI — Travel & Daily Essentials
// Focused catalogue built for conversion. Prices always taken from here on the server.

export type ProductColor = { name: string; hex: string };

export type Product = {
  id: number;
  name: string;
  image: string;
  price: number;
  category: string;
  emoji: string;
  desc: string;
  longDesc: string;
  features: string[];
  colors: ProductColor[];
  sizes: string[];
  badge?: string;
};

export const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "AeroBottle Travel Bottle",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80",
    price: 34.0,
    category: "Travel",
    emoji: "🧴",
    desc: "Insulated steel bottle. 24h cold, 12h hot. Leak-proof.",
    longDesc: "The bottle that stays on your desk and in your bag. Double-wall vacuum insulation, soft-touch finish, wide mouth for ice. 750ml. Built for daily use and travel.",
    features: ["24h cold / 12h hot", "Leak-proof", "750ml", "Soft-touch finish", "Cup-holder friendly"],
    colors: [
      { name: "Forest Green", hex: "#1a5a2a" },
      { name: "Matte Black", hex: "#1a1a1a" },
      { name: "Sand", hex: "#d4b896" },
    ],
    sizes: [],
    badge: "Best Seller",
  },
  {
    id: 2,
    name: "SoftPack Cubes Set",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
    price: 28.0,
    category: "Travel",
    emoji: "🧳",
    desc: "4 packing cubes. Mesh tops, light, compress well.",
    longDesc: "Organise your suitcase without bulk. Four nested sizes, mesh so you can see inside, soft fabric that packs down. Weekend or long-haul ready.",
    features: ["4 sizes", "Mesh visibility", "Lightweight", "Compression friendly", "Washable"],
    colors: [
      { name: "Sage", hex: "#8a9a7a" },
      { name: "Black", hex: "#1a1a1a" },
    ],
    sizes: [],
    badge: "Best Seller",
  },
  {
    id: 3,
    name: "Travel Neck Pillow",
    image: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=800&q=80",
    price: 32.0,
    category: "Travel",
    emoji: "✈️",
    desc: "360° memory foam. Washable cover. Packs small.",
    longDesc: "Proper neck support for flights and long journeys. Soft memory foam, removable cover, compresses into a pouch. Better than cheap U-shaped pillows.",
    features: ["360° support", "Memory foam", "Washable cover", "Packs small", "Adjustable"],
    colors: [
      { name: "Charcoal", hex: "#3a3a3a" },
      { name: "Navy", hex: "#1a1a3e" },
    ],
    sizes: [],
    badge: "Best Seller",
  },
  {
    id: 4,
    name: "Travel Adapter 140W",
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80",
    price: 36.0,
    category: "Travel",
    emoji: "🔌",
    desc: "Universal adapter. 140W GaN. 3× USB-C + USB-A.",
    longDesc: "One adapter for 150+ countries. Charge laptop and phone together. Foldable plugs, safety shutters. Built for real travel.",
    features: ["140W GaN", "150+ countries", "3× USB-C + 1× USB-A", "Foldable plugs", "Safety shutters"],
    colors: [
      { name: "White", hex: "#f5f5f5" },
      { name: "Black", hex: "#1a1a1a" },
    ],
    sizes: [],
    badge: "Best Seller",
  },
  {
    id: 5,
    name: "Essential Daypack",
    image: "https://images.unsplash.com/photo-1622560480654-d96214fdc887?w=800&q=80",
    price: 78.0,
    category: "Carry",
    emoji: "🎒",
    desc: "Everyday backpack. Laptop sleeve, water-resistant, clean shape.",
    longDesc: "Built for daily use without looking like a tech bag. Padded 15\" sleeve, organisation pockets, water-resistant canvas. Works with workwear or weekends.",
    features: ["15\" laptop sleeve", "Water-resistant", "Internal organisation", "Hidden back pocket", "Clean silhouette"],
    colors: [
      { name: "Forest", hex: "#1a5a2a" },
      { name: "Black", hex: "#1a1a1a" },
      { name: "Navy", hex: "#1a1a3e" },
    ],
    sizes: [],
    badge: "Best Seller",
  },
  {
    id: 6,
    name: "Everyday Tote",
    image: "https://images.unsplash.com/photo-1590874103328-eac38a674b4a?w=800&q=80",
    price: 52.0,
    category: "Carry",
    emoji: "👜",
    desc: "Structured canvas tote. Leather handles. Daily-ready.",
    longDesc: "The tote that replaces three bags. Structured base, soft leather handles, internal zip pocket. Enough for laptop, bottle and daily kit.",
    features: ["Structured base", "Leather handles", "Internal zip pocket", "Laptop friendly", "Minimal design"],
    colors: [
      { name: "Sand", hex: "#d4b896" },
      { name: "Black", hex: "#1a1a1a" },
      { name: "Olive", hex: "#4a5a3a" },
    ],
    sizes: [],
  },
  {
    id: 7,
    name: "Contour Memory Pillow",
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
    price: 39.0,
    category: "Recovery",
    emoji: "😴",
    desc: "Ergonomic memory foam. Cooling cover. Side & back sleepers.",
    longDesc: "Supports the natural curve of your neck. Contoured foam, removable cooling cover. For side and back sleepers. Inner liner included.",
    features: ["Contoured shape", "Cooling cover", "Washable", "Side & back sleeper", "Inner liner"],
    colors: [{ name: "White", hex: "#f5f5f5" }],
    sizes: [],
  },
  {
    id: 8,
    name: "Echo Foam Roller",
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80",
    price: 29.0,
    category: "Recovery",
    emoji: "🧘",
    desc: "High-density foam roller. Textured. Built to last.",
    longDesc: "Recovery that lasts. Firm high-density foam with subtle texture. Use before or after training. 45cm.",
    features: ["High-density foam", "Textured surface", "45cm", "Durable core", "Easy to clean"],
    colors: [
      { name: "Forest Green", hex: "#1a5a2a" },
      { name: "Black", hex: "#1a1a1a" },
    ],
    sizes: [],
  },
  {
    id: 9,
    name: "Resistance Bands Set",
    image: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800&q=80",
    price: 24.0,
    category: "Recovery",
    emoji: "💪",
    desc: "5 bands + handles, door anchor, carry bag.",
    longDesc: "Portable strength set. Five levels, foam handles, door anchor, carry bag. Home, travel or add-on to bodyweight work.",
    features: ["5 resistance levels", "Foam handles", "Door anchor", "Carry bag", "Portable"],
    colors: [{ name: "Multi", hex: "#1a5a2a" }],
    sizes: [],
  },
  {
    id: 10,
    name: "LED Face Mask",
    image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&q=80",
    price: 59.0,
    category: "Daily",
    emoji: "💡",
    desc: "7-colour LED mask. USB-C. Soft fit.",
    longDesc: "At-home LED mask with seven modes. Soft silicone, adjustable straps, one-button control. USB-C rechargeable. Cosmetic use only.",
    features: ["7 colour modes", "USB-C rechargeable", "Soft silicone", "Adjustable straps", "Cosmetic use only"],
    colors: [{ name: "White", hex: "#f5f5f5" }],
    sizes: [],
  },
  {
    id: 11,
    name: "Lumina Face Cream",
    image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&q=80",
    price: 42.0,
    category: "Daily",
    emoji: "✨",
    desc: "Daily moisturiser. Niacinamide + HA. Non-greasy.",
    longDesc: "Simple, effective daily cream. Niacinamide and hyaluronic acid. Absorbs fast, no stickiness. 50ml.",
    features: ["Niacinamide + HA", "Non-greasy", "50ml", "Clean formula", "Daily use"],
    colors: [{ name: "Original", hex: "#f5f0e8" }],
    sizes: [],
  },
  {
    id: 12,
    name: "Makeup Brush Set",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80",
    price: 29.0,
    category: "Daily",
    emoji: "💄",
    desc: "12-piece synthetic set. Travel roll included.",
    longDesc: "Full face set in a roll-up case. Soft synthetic bristles for foundation, powder, contour, blush and eyes. Travel-friendly.",
    features: ["12 brushes", "Soft synthetic", "Travel roll", "Full face", "Easy to clean"],
    colors: [
      { name: "Rose Gold", hex: "#b8860c" },
      { name: "Black", hex: "#1a1a1a" },
    ],
    sizes: [],
  },
];

export type CartLine = { id: number; qty: number };

export function priceCart(raw: unknown): {
  lines: { id: number; name: string; price: number; qty: number }[];
  total: number;
} {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) {
    throw new Error("Your basket is empty or too large.");
  }
  const lines = raw.map((item: unknown) => {
    const x = (item ?? {}) as { id?: unknown; qty?: unknown };
    const p = PRODUCTS.find((q) => q.id === Number(x.id));
    const qty = Number(x.qty);
    if (!p) throw new Error("A product in your basket is no longer available.");
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new Error("Each item can be ordered 1 to 20 times.");
    }
    return { id: p.id, name: p.name, price: p.price, qty };
  });
  const pence = lines.reduce((s, l) => s + Math.round(l.price * 100) * l.qty, 0);
  return { lines, total: pence / 100 };
}
