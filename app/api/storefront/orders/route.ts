import { NextRequest, NextResponse } from "next/server";
import { callZayviAwsApi } from "@/lib/aws-api";
import { storefrontApiMarket } from "@/lib/storefront-market-server";
import { isDeliveryQuote } from "@/lib/delivery";

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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid order request." }, { status: 400 });
  }

  const payload = body as {
    customerName?: unknown;
    customerEmail?: unknown;
    phone?: unknown;
    idempotencyKey?: unknown;
    marketCode?: unknown;
    items?: unknown;
    deliveryAddress?: unknown;
    shippingMinor?: unknown;
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
  const requestedMarket = typeof payload.marketCode === "string"
    ? payload.marketCode.trim().toUpperCase()
    : payload.marketCode;

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

  const selection = await storefrontApiMarket(requestedMarket);
  if (selection.error) return selection.error;
  const { market: marketCode } = selection;

  if (payload.deliveryAddress !== undefined) {
    if (!Number.isSafeInteger(payload.shippingMinor) || Number(payload.shippingMinor) < 0) {
      return NextResponse.json({ error: "Review the current delivery fee before saving." }, { status: 400 });
    }

    const quote = await callZayviAwsApi(`/delivery-settings?market=${marketCode}`);
    if (!quote.ok || !isDeliveryQuote(quote.data, marketCode)) {
      return NextResponse.json({ error: "Preview delivery setup is unavailable." }, { status: 503 });
    }
  }

  const result = await callZayviAwsApi("/orders", {
    method: "POST",
    body: {
      customerName,
      customerEmail,
      phone,
      idempotencyKey,
      marketCode,
      items,
      deliveryAddress: payload.deliveryAddress,
      shippingMinor: payload.shippingMinor,
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
