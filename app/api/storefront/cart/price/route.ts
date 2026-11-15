import { NextRequest, NextResponse } from "next/server";
import { callZayviAwsApi } from "@/lib/aws-api";
import type { StorefrontProduct } from "@/lib/storefront-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartRequestLine = {
  id?: unknown;
  qty?: unknown;
  selectedColor?: unknown;
  selectedSize?: unknown;
};

export async function POST(request: NextRequest) {
  let body: { items?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid cart request." }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return NextResponse.json(
      { error: "Your cart is empty or too large." },
      { status: 400 }
    );
  }

  let requested: Array<{ id: string; qty: number; selectedColor?: string; selectedSize?: string }>;

  try {
    requested = body.items.map((raw) => {
      const item = (raw ?? {}) as CartRequestLine;
      const id = typeof item.id === "string" ? item.id : "";
      const qty = Number(item.qty);
      const selectedColor =
        typeof item.selectedColor === "string" ? item.selectedColor : undefined;
      const selectedSize =
        typeof item.selectedSize === "string" ? item.selectedSize : undefined;

      if (!id || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        throw new Error("Invalid cart line.");
      }

      return { id, qty, selectedColor, selectedSize };
    });
  } catch {
    return NextResponse.json({ error: "Invalid cart line." }, { status: 400 });
  }

  const result = await callZayviAwsApi("/products");

  if (!result.ok) {
    return NextResponse.json(
      { error: "Unable to validate cart pricing." },
      { status: 503 }
    );
  }

  const payload = result.data as { products?: StorefrontProduct[] };
  const products = Array.isArray(payload?.products) ? payload.products : [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  const lines = [];

  for (const line of requested) {
    const product = productMap.get(line.id);

    if (
      !product ||
      product.status !== "active" ||
      product.lifecycleStatus !== "active" ||
      product.availabilityStatus !== "available" ||
      !Number.isFinite(Number(product.price))
    ) {
      return NextResponse.json(
        { error: "A product in your cart is no longer available." },
        { status: 409 }
      );
    }

    if (
      line.selectedColor &&
      !product.colors.some((colour) => colour.name === line.selectedColor)
    ) {
      return NextResponse.json(
        { error: "A selected colour is not available for this product." },
        { status: 409 }
      );
    }

    if (product.sizes.length > 0 && !line.selectedSize) {
      return NextResponse.json(
        { error: "Please select a size for this product." },
        { status: 409 }
      );
    }

    if (line.selectedSize && !product.sizes.includes(line.selectedSize)) {
      return NextResponse.json(
        { error: "A selected size is not available for this product." },
        { status: 409 }
      );
    }

    const unitPrice = Number(product.price);
    const lineTotalPence = Math.round(unitPrice * 100) * line.qty;

    lines.push({
      id: product.id,
      name: product.name,
      image: product.image,
      emoji: product.emoji,
      unitPrice,
      qty: line.qty,
      selectedColor: line.selectedColor,
      selectedSize: line.selectedSize,
      currency: product.currency || "GBP",
      lineTotal: lineTotalPence / 100,
    });
  }

  const subtotalPence = lines.reduce(
    (sum, line) => sum + Math.round(line.unitPrice * 100) * line.qty,
    0
  );

  return NextResponse.json(
    {
      source: "postgresql",
      currency: "GBP",
      lines,
      subtotal: subtotalPence / 100,
      purchasingEnabled: false,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
