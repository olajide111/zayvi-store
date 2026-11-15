import "server-only";

import { randomBytes } from "node:crypto";
import { PRODUCTS, priceCart } from "@/lib/products";

export type CheckoutAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postcode?: string;
  state?: string;
  countryCode: string;
};

export type CheckoutCustomer = {
  email: string;
  name?: string;
};

export type CheckoutCartItem = {
  id: number;
  qty: number;
  selectedColor?: string;
  selectedSize?: string;
};

export function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

function cleanText(value: unknown, max: number, required = false) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new Error("Required checkout details are missing.");
  if (text.length > max) throw new Error("A checkout field is too long.");
  return text;
}

export function normalizeAddress(value: unknown): CheckoutAddress {
  const input = (value ?? {}) as Record<string, unknown>;
  const countryCode = cleanText(input.countryCode, 2, true).toUpperCase();

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("Enter a valid delivery country.");
  }

  return {
    name: cleanText(input.name, 120, true),
    line1: cleanText(input.line1, 180, true),
    line2: cleanText(input.line2, 180) || undefined,
    city: cleanText(input.city, 120, true),
    postcode: cleanText(input.postcode, 32) || undefined,
    state: cleanText(input.state, 120) || undefined,
    countryCode,
  };
}

export function prepareOrderItems(raw: unknown) {
  const priced = priceCart(raw);
  const submitted = raw as CheckoutCartItem[];

  const items = priced.lines.map((line, index) => {
    const submittedLine = submitted[index] ?? {};
    const product = PRODUCTS.find((item) => item.id === line.id);
    if (!product) throw new Error("A product in your basket is unavailable.");

    const selectedColor =
      typeof submittedLine.selectedColor === "string"
        ? submittedLine.selectedColor.trim()
        : "";

    if (
      selectedColor &&
      !product.colors.some((color) => color.name === selectedColor)
    ) {
      throw new Error("A selected product colour is unavailable.");
    }

    const selectedSize =
      typeof submittedLine.selectedSize === "string"
        ? submittedLine.selectedSize.trim()
        : "";

    if (selectedSize && !product.sizes.includes(selectedSize)) {
      throw new Error("A selected product size is unavailable.");
    }

    const unitPriceMinor = Math.round(line.price * 100);

    return {
      product_id: line.id,
      product_name: line.name,
      selected_color: selectedColor || null,
      selected_size: selectedSize || null,
      quantity: line.qty,
      unit_price_minor: unitPriceMinor,
      line_total_minor: unitPriceMinor * line.qty,
    };
  });

  return {
    items,
    totalMinor: Math.round(priced.total * 100),
  };
}

export function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `ZV-${date}-${suffix}`;
}
