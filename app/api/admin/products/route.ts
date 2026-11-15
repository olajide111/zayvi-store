import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await callZayviAwsApi("/products");

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Unable to load catalogue from AWS.",
        backendStatus: result.status,
      },
      { status: result.status || 502 }
    );
  }

  const payload = result.data as {
    source?: string;
    total?: number;
    products?: Array<{ category?: string }>;
  };

  const products = Array.isArray(payload?.products) ? payload.products : [];
  const categories = [
    ...new Set(
      products
        .map((product) => product.category)
        .filter((category): category is string => Boolean(category))
    ),
  ];

  return NextResponse.json({
    source: payload?.source || "postgresql",
    total: payload?.total ?? products.length,
    categories,
    products,
  });
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await callZayviAwsApi("/products", {
    method: "POST",
    body,
  });

  if (!result.ok) {
    const backend = result.data as { error?: string } | null;
    return NextResponse.json(
      {
        error: backend?.error || "Unable to create product.",
        backendStatus: result.status,
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data, { status: 201 });
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

  const id = typeof body.id === "string" ? body.id : "";

  if (!id) {
    return NextResponse.json({ error: "Product id is required." }, { status: 400 });
  }

  const { id: _id, ...updates } = body;

  const result = await callZayviAwsApi(`/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: updates,
  });

  if (!result.ok) {
    const backend = result.data as { error?: string } | null;
    return NextResponse.json(
      {
        error: backend?.error || "Unable to update product.",
        backendStatus: result.status,
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
