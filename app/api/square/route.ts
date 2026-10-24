import { NextRequest, NextResponse } from "next/server";
import { priceCart } from "@/lib/products";

/**
 * Square payment endpoint.
 * Requires env vars:
 *   SQUARE_ACCESS_TOKEN
 *   SQUARE_LOCATION_ID
 *   NEXT_PUBLIC_SQUARE_APP_ID (for frontend if using Web Payments SDK)
 *
 * For a full card form experience, use the Square Web Payments SDK on the client
 * and send the resulting sourceId here.
 */
export async function POST(req: NextRequest) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) {
    return NextResponse.json(
      { error: "Square is not configured yet. Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { items, sourceId } = body;

    if (!sourceId) {
      return NextResponse.json({ error: "Missing payment source." }, { status: 400 });
    }

    let total: number;
    try {
      total = priceCart(items).total;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Basket could not be checked." },
        { status: 400 }
      );
    }

    // Amount in smallest currency unit (pence for GBP)
    const amount = Math.round(total * 100);

    const res = await fetch("https://connect.squareup.com/v2/payments", {
      method: "POST",
      headers: {
        "Square-Version": "2024-01-18",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: crypto.randomUUID(),
        amount_money: {
          amount,
          currency: "GBP",
        },
        location_id: locationId,
        note: "ZAYVI order",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Square payment failed", data);
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || "Payment failed. Please try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: data.payment?.id,
      redirect: process.env.NEXT_PUBLIC_STORE_URL + "/success",
    });
  } catch (err) {
    console.error("Square route error", err);
    return NextResponse.json({ error: "Checkout is unavailable right now." }, { status: 500 });
  }
}
