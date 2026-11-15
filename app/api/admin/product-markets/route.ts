import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_MARKETS = new Set(["GB", "NG"]);

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const market = (
    request.nextUrl.searchParams.get("market") || "NG"
  ).toUpperCase();

  if (!SUPPORTED_MARKETS.has(market)) {
    return NextResponse.json({ error: "Unsupported market." }, { status: 400 });
  }

  const result = await callZayviAwsApi(
    "/products?market=" + encodeURIComponent(market)
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Unable to load product market data.",
        backendStatus: result.status,
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data, {
    headers: { "cache-control": "no-store" },
  });
}

export async function PATCH(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const productId =
    typeof body.productId === "string" ? body.productId.trim() : "";
  const marketCode =
    typeof body.marketCode === "string"
      ? body.marketCode.trim().toUpperCase()
      : "";

  if (!productId || !SUPPORTED_MARKETS.has(marketCode)) {
    return NextResponse.json(
      { error: "Valid product and market references are required." },
      { status: 400 }
    );
  }

  const price =
    body.price === null || body.price === undefined || body.price === ""
      ? null
      : Number(body.price);

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return NextResponse.json(
      { error: "Market price must be a non-negative number." },
      { status: 400 }
    );
  }

  const availabilityStatus =
    typeof body.availabilityStatus === "string"
      ? body.availabilityStatus
      : "unknown";
  const publicationStatus =
    typeof body.publicationStatus === "string"
      ? body.publicationStatus
      : "not_listed";

  const result = await callZayviAwsApi(
    "/products/" +
      encodeURIComponent(productId) +
      "/markets/" +
      encodeURIComponent(marketCode),
    {
      method: "PATCH",
      body: {
        price,
        availabilityStatus,
        publicationStatus,
      },
    }
  );

  if (!result.ok) {
    const backend = result.data as { error?: string } | null;

    return NextResponse.json(
      {
        error: backend?.error || "Unable to update product market data.",
        backendStatus: result.status,
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
