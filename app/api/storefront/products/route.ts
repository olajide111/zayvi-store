import { NextResponse } from "next/server";
import { callZayviAwsApi } from "@/lib/aws-api";
import type { StorefrontProduct } from "@/lib/storefront-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = (url.searchParams.get("market") || "GB").toUpperCase();

  if (!["GB", "NG"].includes(market)) {
    return NextResponse.json({ error: "Unsupported market." }, { status: 400 });
  }

  const result = await callZayviAwsApi(
    "/products?market=" + encodeURIComponent(market)
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "Storefront catalogue is temporarily unavailable." },
      { status: 503 }
    );
  }

  const payload = result.data as {
    source?: string;
    products?: StorefrontProduct[];
  };

  const products = (Array.isArray(payload?.products) ? payload.products : [])
    .filter(
      (product) =>
        product.status === "active" &&
        product.lifecycleStatus === "active" &&
        product.availabilityStatus === "available" &&
        Number.isFinite(Number(product.price))
    )
    .map((product) => ({
      id: product.id,
      canonicalCode: product.canonicalCode,
      slug: product.slug,
      name: product.name,
      image: product.image,
      price: Number(product.price),
      currency: product.currency || (market === "NG" ? "NGN" : "GBP"),
      marketCode: product.marketCode || market,
      category: product.category,
      emoji: product.emoji,
      desc: product.desc,
      longDesc: product.longDesc,
      features: product.features,
      colors: product.colors,
      sizes: product.sizes,
      badge: product.badge,
      status: product.status,
      lifecycleStatus: product.lifecycleStatus,
      publicationStatus: product.publicationStatus,
      availabilityStatus: product.availabilityStatus,
    }));

  return NextResponse.json(
    {
      source: payload?.source || "postgresql",
      total: products.length,
      market,
      currency: market === "NG" ? "NGN" : "GBP",
      products,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
