import { NextRequest, NextResponse } from "next/server";

import {
  assertOrderReadyForPayment,
  createPaymentAttempt,
  getStoredOrder,
} from "@/lib/database/orders";

const SQUARE_API_VERSION = "2026-09-16";

export async function POST(req: NextRequest) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment =
    process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

  if (!accessToken || !locationId) {
    return NextResponse.json(
      { error: "Square card payments are not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { orderId, sourceId, buyer, idempotencyKey } = body ?? {};

    if (
      typeof orderId !== "string" ||
      !orderId.trim() ||
      typeof sourceId !== "string" ||
      !sourceId
    ) {
      return NextResponse.json(
        { error: "A ZAYVI order and card payment token are required." },
        { status: 400 }
      );
    }

    if (
      typeof idempotencyKey !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(idempotencyKey)
    ) {
      return NextResponse.json(
        { error: "A valid payment request reference is required." },
        { status: 400 }
      );
    }

    if (
      !buyer ||
      typeof buyer !== "object" ||
      typeof buyer.givenName !== "string" ||
      !buyer.givenName.trim() ||
      typeof buyer.familyName !== "string" ||
      !buyer.familyName.trim() ||
      typeof buyer.email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(buyer.email) ||
      typeof buyer.addressLine !== "string" ||
      !buyer.addressLine.trim() ||
      typeof buyer.city !== "string" ||
      !buyer.city.trim() ||
      typeof buyer.postcode !== "string" ||
      !buyer.postcode.trim()
    ) {
      return NextResponse.json(
        { error: "Valid billing details are required for card verification." },
        { status: 400 }
      );
    }

    const zayviOrder = await getStoredOrder(orderId.trim());
    assertOrderReadyForPayment(zayviOrder);

    if (!zayviOrder || zayviOrder.currency !== "GBP") {
      return NextResponse.json(
        { error: "Square checkout is currently available for GBP orders only." },
        { status: 400 }
      );
    }

    const apiBase =
      environment === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";

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
        amount_money: {
          amount: zayviOrder.total_minor,
          currency: zayviOrder.currency,
        },
        location_id: locationId,
        reference_id: zayviOrder.order_number,
        buyer_email_address: buyer.email.trim(),
        billing_address: {
          address_line_1: buyer.addressLine.trim(),
          locality: buyer.city.trim(),
          postal_code: buyer.postcode.trim(),
          country: "GB",
        },
        customer_details: {
          customer_initiated: true,
          seller_keyed_in: false,
        },
        note: "ZAYVI " + zayviOrder.order_number,
      }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.payment?.id) {
      console.error("Square payment rejected", {
        status: response.status,
        errors: data.errors?.map((item: { code?: string }) => item.code),
      });
      return NextResponse.json(
        {
          error:
            data.errors?.[0]?.detail ||
            "Square could not process this card payment.",
        },
        { status: 402 }
      );
    }

    await createPaymentAttempt({
      orderId: zayviOrder.id,
      platform: "square",
      externalPaymentId: data.payment.id,
      externalReference: zayviOrder.order_number,
      amountMinor: zayviOrder.total_minor,
      currency: zayviOrder.currency,
      idempotencyKey,
    });

    const storeUrl = process.env.NEXT_PUBLIC_STORE_URL || req.nextUrl.origin;

    return NextResponse.json({
      success: true,
      paymentId: data.payment.id,
      redirect:
        storeUrl +
        "/success?provider=square&payment_id=" +
        encodeURIComponent(data.payment.id) +
        "&zayvi_order_id=" +
        encodeURIComponent(zayviOrder.id),
    });
  } catch (error) {
    console.error("Square payment route error", error);
    return NextResponse.json(
      { error: "Card checkout is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
}
