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

  if (!customerName || !customerEmail || !customerEmail.includes("@")) {
    return NextResponse.json(
      { error: "Name and a valid email are required." },
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
    };

    return {
      id: typeof item.id === "string" ? item.id : "",
      qty: Number(item.qty),
      selectedColor:
        typeof item.selectedColor === "string"
          ? item.selectedColor
          : undefined,
    };
  });

  const result = await callZayviAwsApi("/orders", {
    method: "POST",
    body: {
      customerName,
      customerEmail,
      phone,
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
