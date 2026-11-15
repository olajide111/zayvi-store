import { NextRequest, NextResponse } from "next/server";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "Draft order creation is disabled in production." },
      { status: 503 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid order request." }, { status: 400 });
  }

  const payload = body as {
    customerName?: unknown;
    customerEmail?: unknown;
    phone?: unknown;
    idempotencyKey?: unknown;
    marketCode?: unknown;
    items?: unknown;
  };

  const customerName =
    typeof payload.customerName === "string" ? payload.customerName.trim() : "";
  const customerEmail =
    typeof payload.customerEmail === "string"
      ? payload.customerEmail.trim().toLowerCase()
      : "";
  const phone =
    typeof payload.phone === "string" && payload.phone.trim()
      ? payload.phone.trim()
      : undefined;
  const marketCode =
    typeof payload.marketCode === "string"
      ? payload.marketCode.trim().toUpperCase()
      : "GB";

  if (!["GB", "NG"].includes(marketCode)) {
    return NextResponse.json({ error: "Unsupported market." }, { status: 400 });
  }

  const idempotencyKey =
    typeof payload.idempotencyKey === "string"
      ? payload.idempotencyKey.trim()
      : "";

  if (!customerName || !customerEmail || !customerEmail.includes("@")) {
    return NextResponse.json(
      { error: "Name and a valid email are required." },
      { status: 400 }
    );
  }

  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    return NextResponse.json(
      { error: "A valid order idempotency key is required." },
      { status: 400 }
    );
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const items = payload.items.map((raw) => {
    const item = (raw ?? {}) as {
      id?: unknown;
      qty?: unknown;
      selectedColor?: unknown;
      selectedSize?: unknown;
    };

    return {
      id: typeof item.id === "string" ? item.id : "",
      qty: Number(item.qty),
      selectedColor:
        typeof item.selectedColor === "string"
          ? item.selectedColor
          : undefined,
      selectedSize:
        typeof item.selectedSize === "string"
          ? item.selectedSize
          : undefined,
    };
  });

  const result = await callZayviAwsApi("/orders", {
    method: "POST",
    body: {
      customerName,
      customerEmail,
      phone,
      idempotencyKey,
      marketCode,
      items,
    },
  });

  if (!result.ok) {
    const backend =
      result.data && typeof result.data === "object"
        ? (result.data as { error?: unknown }).error
        : undefined;

    return NextResponse.json(
      {
        error:
          typeof backend === "string"
            ? backend
            : "Unable to create Preview draft order.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data, {
    status: 201,
    headers: {
      "cache-control": "no-store",
    },
  });
}
