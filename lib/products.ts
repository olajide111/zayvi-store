// ZAYVI catalogue – curated everyday essentials
// Prices are always taken from here on the server (never trust the browser).

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
  badge?: string; // e.g. "Best Seller", "New"
};

export const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "AeroBottle Travel Bottle",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80",
    price: 34.0,
    category: "Travel",
    emoji: "🧴",
    desc: "Double-wall insulated stainless steel bottle. Keeps drinks cold 24h or hot 12h.",
    longDesc: "The everyday bottle that actually looks good on your desk or in your bag. Double-wall vacuum insulation keeps water ice-cold for 24 hours and coffee hot for 12. Leak-proof lid, soft-touch powder coat, and a wide mouth that fits ice cubes. 750ml capacity.",
    features: ["24h cold / 12h hot", "Leak-proof lid", "750ml capacity", "Soft-touch finish", "Fits most cup holders"],
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
    name: "Lumina Face Cream",
    image: "https://images.unsplash.com/photo-1620916569498-e3c0c4e5e5e5?w=800&q=80",
    price: 42.0,
    category: "Beauty",
    emoji: "✨",
    desc: "Lightweight daily moisturiser with niacinamide and hyaluronic acid. Clean, non-greasy finish.",
    longDesc: "A simple, effective daily face cream designed for real skin. Niacinamide helps even tone, hyaluronic acid keeps skin plump, and the texture absorbs in seconds without stickiness. Suitable for most skin types. 50ml jar.",
    features: ["Niacinamide + HA", "Non-greasy formula", "50ml", "Clean ingredients", "Daily use"],
    colors: [{ name: "Original", hex: "#f5f0e8" }],
    sizes: [],
    badge: "Best Seller",
  },
  {
    id: 3,
    name: "Essential Daypack",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
    price: 78.0,
    category: "Accessories",
    emoji: "🎒",
    desc: "Structured everyday backpack. Laptop sleeve, water-resistant canvas, clean silhouette.",
    longDesc: "Built for daily use without looking like a tech bag. Water-resistant canvas, padded 15\" laptop sleeve, internal organisation pockets, and a clean structured shape that works with workwear or weekend clothes. Adjustable straps and a hidden back pocket for valuables.",
    features: ["15\" laptop sleeve", "Water-resistant canvas", "Internal organisation", "Hidden back pocket", "Clean silhouette"],
    colors: [
      { name: "Forest", hex: "#1a5a2a" },
      { name: "Black", hex: "#1a1a1a" },
      { name: "Navy", hex: "#1a1a3e" },
    ],
    sizes: [],
    badge: "Best Seller",
  },
  {
    id: 4,
    name: "Echo Foam Roller",
    image: "https://images.unsplash.com/photo-1599058945522-28d884b0e5e0?w=800&q=80",
    price: 29.0,
    category: "Fitness",
    emoji: "🧘",
    desc: "High-density foam roller for recovery. Textured surface, durable core.",
    longDesc: "A simple recovery tool that actually lasts. High-density foam with a firm core and subtle texture that works for both beginners and regular training. Use before or after workouts to release tight muscles. 45cm length.",
    features: ["High-density foam", "Textured surface", "45cm length", "Durable core", "Easy to clean"],
    colors: [
      { name: "Forest Green", hex: "#1a5a2a" },
      { name: "Black", hex: "#1a1a1a" },
    ],
    sizes: [],
    badge: "Best Seller",
  },
  {
    id: 5,
    name: "CloudRest Pet Bed",
    image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=80",
    price: 56.0,
    category: "Pets",
    emoji: "🐕",
    desc: "Orthopaedic memory foam pet bed with washable cover. Soft raised edges.",
    longDesc: "A proper bed for dogs and cats that actually supports joints. Orthopaedic memory foam base, soft raised bolster edges for resting the head, and a removable machine-washable cover. Available in two sizes.",
    features: ["Memory foam base", "Washable cover", "Raised edges", "Non-slip base", "Two sizes"],
    colors: [
      { name: "Beige", hex: "#d4b896" },
      { name: "Grey", hex: "#8a8a8a" },
    ],
    sizes: ["Medium", "Large"],
    badge: "Best Seller",
  },
  {
    id: 6,
    name: "SoftPack Cubes Set",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
    price: 28.0,
    category: "Travel",
    emoji: "🧳",
    desc: "Set of 4 packing cubes. Lightweight, compression-friendly, mesh top.",
    longDesc: "Keep your suitcase organised without the bulk. Four sizes that nest together, mesh tops so you can see what’s inside, and a soft but durable fabric that compresses well. Ideal for weekend trips or longer travel.",
    features: ["4 sizes included", "Mesh visibility", "Lightweight", "Compression friendly", "Machine washable"],
    colors: [
      { name: "Sage", hex: "#8a9a7a" },
      { name: "Black", hex: "#1a1a1a" },
    ],
    sizes: [],
  },
  {
    id: 7,
    name: "Contour Memory Pillow",
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
    price: 39.0,
    category: "Health",
    emoji: "😴",
    desc: "Ergonomic memory foam pillow with cooling cover. Side and back sleeper friendly.",
    longDesc: "Designed to support the natural curve of your neck. Contoured memory foam that slowly responds to pressure, plus a removable cooling cover. Suitable for side and back sleepers. Comes with a protective inner liner.",
    features: ["Contoured shape", "Cooling cover", "Removable & washable", "Side & back sleeper", "Inner liner included"],
    colors: [{ name: "White", hex: "#f5f5f5" }],
    sizes: [],
  },
  {
    id: 8,
    name: "Travel Neck Pillow",
    image: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=800&q=80",
    price: 32.0,
    category: "Travel",
    emoji: "✈️",
    desc: "360° memory foam neck support. Soft, washable cover, packs small.",
    longDesc: "Proper neck support for flights, trains and long car journeys. Soft memory foam that wraps 360°, a removable washable cover, and a design that compresses into a small pouch. Far more comfortable than the cheap U-shaped versions.",
    features: ["360° support", "Memory foam", "Washable cover", "Packs small", "Adjustable"],
    colors: [
      { name: "Charcoal", hex: "#3a3a3a" },
      { name: "Navy", hex: "#1a1a3e" },
    ],
    sizes: [],
  },
  {
    id: 9,
    name: "LED Face Mask",
    image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&q=80",
    price: 59.0,
    category: "Beauty",
    emoji: "💡",
    desc: "7-colour LED face mask. Rechargeable, comfortable fit, simple controls.",
    longDesc: "A clean, modern LED face mask with seven light modes. Soft silicone feel, adjustable straps, and a simple one-button control. Rechargeable via USB-C. Not a medical device — for cosmetic use only. Follow the included guide for best results.",
    features: ["7 colour modes", "USB-C rechargeable", "Soft silicone", "Adjustable straps", "Cosmetic use only"],
    colors: [{ name: "White", hex: "#f5f5f5" }],
    sizes: [],
  },
  {
    id: 10,
    name: "Everyday Tote",
    image: "https://images.unsplash.com/photo-1590874103328-eac38a674b4a?w=800&q=80",
    price: 52.0,
    category: "Accessories",
    emoji: "👜",
    desc: "Structured canvas tote with leather handles. Spacious, minimal, daily-ready.",
    longDesc: "The tote that replaces three other bags. Structured base so it stands upright, soft leather handles, internal zip pocket, and enough room for a laptop, water bottle and daily essentials. Clean enough for work, casual enough for weekends.",
    features: ["Structured base", "Leather handles", "Internal zip pocket", "Laptop friendly", "Minimal design"],
    colors: [
      { name: "Sand", hex: "#d4b896" },
      { name: "Black", hex: "#1a1a1a" },
      { name: "Olive", hex: "#4a5a3a" },
    ],
    sizes: [],
  },
  {
    id: 11,
    name: "Resistance Bands Set",
    image: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800&q=80",
    price: 24.0,
    category: "Fitness",
    emoji: "💪",
    desc: "Set of 5 resistance bands with handles, door anchor and carry bag.",
    longDesc: "A complete portable strength set. Five resistance levels, comfortable foam handles, door anchor for full-body work, and a compact carry bag. Ideal for home workouts, travel, or adding resistance to bodyweight training.",
    features: ["5 resistance levels", "Foam handles", "Door anchor included", "Carry bag", "Portable"],
    colors: [{ name: "Multi", hex: "#1a5a2a" }],
    sizes: [],
  },
  {
    id: 12,
    name: "Smart Pet Fountain",
    image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=80",
    price: 48.0,
    category: "Pets",
    emoji: "🐱",
    desc: "Quiet automatic water fountain with filter. Encourages pets to drink more.",
    longDesc: "A quiet, filtered water fountain that makes drinking more appealing for cats and small dogs. Triple filtration, ultra-quiet pump, and a design that fits most home interiors. Easy to clean and refill.",
    features: ["Triple filtration", "Ultra-quiet pump", "Easy clean", "Encourages drinking", "Modern design"],
    colors: [
      { name: "White", hex: "#f5f5f5" },
      { name: "Soft Grey", hex: "#c0c0c0" },
    ],
    sizes: [],
  },
  {
    id: 13,
    name: "Travel Adapter 140W",
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80",
    price: 36.0,
    category: "Travel",
    emoji: "🔌",
    desc: "Universal travel adapter with 140W GaN charging. 3× USB-C + 1× USB-A.",
    longDesc: "One adapter for 150+ countries. 140W GaN technology means you can charge a laptop and phone at the same time without bulk. Three USB-C ports and one USB-A, foldable plugs, and built-in safety shutters.",
    features: ["140W GaN", "Works in 150+ countries", "3× USB-C + 1× USB-A", "Foldable plugs", "Safety shutters"],
    colors: [
      { name: "White", hex: "#f5f5f5" },
      { name: "Black", hex: "#1a1a1a" },
    ],
    sizes: [],
  },
  {
    id: 14,
    name: "Makeup Brush Set",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80",
    price: 29.0,
    category: "Beauty",
    emoji: "💄",
    desc: "12-piece soft synthetic brush set with travel roll. Full face coverage.",
    longDesc: "A complete set of soft synthetic brushes for foundation, powder, contour, blush and eyes. Dense but soft bristles that blend well, and a roll-up case that keeps everything organised when travelling.",
    features: ["12 brushes", "Soft synthetic bristles", "Travel roll included", "Full face set", "Easy to clean"],
    colors: [
      { name: "Rose Gold", hex: "#b8860c" },
      { name: "Black", hex: "#1a1a1a" },
    ],
    sizes: [],
  },
];

export type CartLine = { id: number; qty: number };

/** Rebuild the order from the catalogue: prices and names come from here, never from the browser. */
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
