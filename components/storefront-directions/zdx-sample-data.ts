/**
 * Sample content for direction previews. It is clearly labelled sample data,
 * never read from or written to the catalogue, and never shown on the live
 * store. Names are prefixed `Zdx` / `ZDX_` so they cannot collide with the
 * Zayvi team's own code.
 */
export type ZdxSampleProduct = {
  id: string;
  name: string;
  department: string;
  seller: string;
  priceGbp: number;
  priceNgn: number;
  description: string;
  detail: string;
  tint: [string, string];
};

export const ZDX_SAMPLE_PRODUCTS: ZdxSampleProduct[] = [
  { id: "s1", name: "Ankara Print Tote Bag", department: "Fashion", seller: "Eko Textiles", priceGbp: 34, priceNgn: 57000, description: "A roomy cotton tote in a bold wax-print fabric with an inside zip pocket.", detail: "Cotton, 40 x 36 cm", tint: ["#E7B43C", "#B04A22"] },
  { id: "s2", name: "Shea Body Butter 250 g", department: "Beauty", seller: "Brixton Beauty", priceGbp: 12, priceNgn: 20000, description: "A rich unrefined shea butter for skin and hair, in a recyclable tin.", detail: "250 g tin", tint: ["#F3C9B0", "#C8693F"] },
  { id: "s3", name: "Wireless Earbuds", department: "Phones and audio", seller: "Abuja Audio", priceGbp: 29, priceNgn: 49000, description: "In-ear wireless earbuds with a charging case and three sizes of tips.", detail: "Bluetooth, USB-C case", tint: ["#9DB8E8", "#2F4A7D"] },
  { id: "s4", name: "Jollof Spice Blend, 3 pack", department: "Grocery", seller: "Mama Nkechi Foods", priceGbp: 9, priceNgn: 15000, description: "A blend of ground peppers and spices for jollof rice. Three 80 g pouches.", detail: "3 x 80 g", tint: ["#F2D27A", "#B3541E"] },
  { id: "s5", name: "Woven Basket Set", department: "Home", seller: "Eko Textiles", priceGbp: 42, priceNgn: 71000, description: "A set of three hand-woven baskets in graduated sizes.", detail: "Set of 3", tint: ["#BFD9C8", "#0B5D3B"] },
  { id: "s6", name: "Linen Cushion Cover", department: "Home", seller: "Eko Textiles", priceGbp: 18, priceNgn: 30000, description: "A washed linen cushion cover with a hidden zip. Fits a 45 cm cushion.", detail: "Linen, 45 x 45 cm", tint: ["#D9CBB0", "#6B5B4A"] },
];

export const ZDX_SAMPLE_DEPARTMENTS = ["All", "Fashion", "Beauty", "Phones and audio", "Home", "Grocery"] as const;

export type ZdxMarket = "GB" | "NG";

export function zdxFormatPrice(product: ZdxSampleProduct, market: ZdxMarket, quantity = 1): string {
  return market === "NG"
    ? "₦" + (product.priceNgn * quantity).toLocaleString("en-GB")
    : "£" + (product.priceGbp * quantity).toLocaleString("en-GB");
}
