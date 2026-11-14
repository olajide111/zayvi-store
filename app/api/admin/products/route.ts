import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { PRODUCTS } from "@/lib/products";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const categories = [...new Set(PRODUCTS.map((product) => product.category))];

  return NextResponse.json({
    source: "current_storefront_catalogue",
    total: PRODUCTS.length,
    categories,
    products: PRODUCTS,
  });
}
