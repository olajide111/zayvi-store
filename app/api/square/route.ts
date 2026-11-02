import { NextRequest, NextResponse } from "next/server";
import { priceCart } from "@/lib/products";

const SQUARE_API_VERSION = "2026-09-16";

export async function POST(req: NextRequest) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

  if (!accessToken || !locationId) {
    return NextResponse.json({ error: "Square card payments are not configured." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { items, sourceId, buyer, idempotencyKey } = body ?? {};
    if (!Array.isArray(items) || items.length === 0 || typeof sourceId !== "string" || !sourceId) {
      return NextResponse.json({ error: "Your basket or card payment token is missing." }, { status: 400 });
    }
    if (typeof idempotencyKey !== "string" || !/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
      return NextResponse.json({ error: "A valid payment request reference is required." }, { status: 400 });
    }
    if (!buyer || typeof buyer !== "object" ||
        typeof buyer.givenName !== "string" || !buyer.givenName.trim() ||
        typeof buyer.familyName !== "string" || !buyer.familyName.trim() ||
        typeof buyer.email !== "string" || !/^\S+@\S+\.\S+$/.test(buyer.email) ||
        typeof buyer.addressLine !== "string" || !buyer.addressLine.trim() ||
        typeof buyer.city !== "string" || !buyer.city.trim() ||
        typeof buyer.postcode !== "string" || !buyer.postcode.trim()) {
      return NextResponse.json({ error: "Valid billing details are required for card verification." }, { status: 400 });
    }

    let total: number;
    try {
      total = priceCart(items).total;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Basket could not be checked." }, { status: 400 });
    }

    const amount = Math.round(total * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "The basket total is invalid." }, { status: 400 });
    }

    const apiBase = environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
    const response = await fetch(apiBase + "/v2/payments", {
      method: "POST",
      headers: {
        "Square-Version": SQUARE_API_VERSION,
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: idempotencyKey,
        amount_money: { amount, currency: "GBP" },
        location_id: locationId,
        buyer_email_address: buyer.email.trim(),
        billing_address: {
          address_line_1: buyer.addressLine.trim(),
          locality: buyer.city.trim(),
          postal_code: buyer.postcode.trim(),
          country: "GB",
        },
        customer_details: { customer_initiated: true, seller_keyed_in: false },
        note: "ZAYVI online order",
      }),
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok || !data.payment?.id) {
      console.error("Square payment rejected", { status: response.status, errors: data.errors?.map((item: { code?: string }) => item.code) });
      return NextResponse.json({ error: data.errors?.[0]?.detail || "Square could not process this card payment." }, { status: 402 });
    }

    const storeUrl = process.env.NEXT_PUBLIC_STORE_URL || req.nextUrl.origin;
    return NextResponse.json({
      success: true,
      paymentId: data.payment.id,
      redirect: storeUrl + "/success?provider=square&payment_id=" + encodeURIComponent(data.payment.id),
    });
  } catch (error) {
    console.error("Square payment route error", error);
    return NextResponse.json({ error: "Card checkout is unavailable right now. Please try again." }, { status: 500 });
  }
}
