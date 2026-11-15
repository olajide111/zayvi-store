import { NextRequest, NextResponse } from "next/server";

import {
  assertOrderReadyForPayment,
  createPaymentAttempt,
  getStoredOrder,
} from "@/lib/database/orders";

const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

async function getAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;

  if (!clientId || !secret) throw new Error("PayPal is not configured.");

  const auth = Buffer.from(clientId + ":" + secret).toString("base64");
  const response = await fetch(PAYPAL_BASE + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) throw new Error("PayPal authentication failed.");

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("PayPal did not return an access token.");
  }

  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId =
      typeof body?.orderId === "string" ? body.orderId.trim() : "";

    if (!orderId) {
      return NextResponse.json(
        { error: "A ZAYVI order is required before payment." },
        { status: 400 }
      );
    }

    const zayviOrder = await getStoredOrder(orderId);
    assertOrderReadyForPayment(zayviOrder);

    if (!zayviOrder || zayviOrder.currency !== "GBP") {
      return NextResponse.json(
        { error: "PayPal checkout is currently available for GBP orders only." },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();
    const storeUrl = process.env.NEXT_PUBLIC_STORE_URL || req.nextUrl.origin;
    const value = (zayviOrder.total_minor / 100).toFixed(2);

    const response = await fetch(PAYPAL_BASE + "/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        "PayPal-Request-Id": "zayvi-" + zayviOrder.order_number,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: zayviOrder.order_number,
            custom_id: zayviOrder.id,
            invoice_id: zayviOrder.order_number,
            amount: {
              currency_code: zayviOrder.currency,
              value,
            },
            description: "ZAYVI " + zayviOrder.order_number,
          },
        ],
        application_context: {
          return_url:
            storeUrl +
            "/success?provider=paypal&zayvi_order_id=" +
            encodeURIComponent(zayviOrder.id),
          cancel_url:
            storeUrl +
            "/checkout?cancelled=paypal&order_id=" +
            encodeURIComponent(zayviOrder.id),
          brand_name: "ZAYVI",
          user_action: "PAY_NOW",
        },
      }),
      cache: "no-store",
    });

    const paypalOrder = await response.json();

    if (!response.ok) {
      console.error("PayPal order creation rejected", {
        status: response.status,
        issue: paypalOrder?.name,
      });
      return NextResponse.json(
        { error: "PayPal could not start checkout. Please try again." },
        { status: 502 }
      );
    }

    const approveLink = paypalOrder.links?.find(
      (link: { rel: string; href: string }) => link.rel === "approve"
    )?.href;

    if (!approveLink || typeof paypalOrder.id !== "string") {
      throw new Error("PayPal did not return a valid approval link.");
    }

    await createPaymentAttempt({
      orderId: zayviOrder.id,
      platform: "paypal",
      externalPaymentId: paypalOrder.id,
      externalReference: zayviOrder.order_number,
      amountMinor: zayviOrder.total_minor,
      currency: zayviOrder.currency,
      idempotencyKey: "zayvi-" + zayviOrder.order_number,
      checkoutUrl: approveLink,
    });

    return NextResponse.json({
      url: approveLink,
      orderId: paypalOrder.id,
      zayviOrderId: zayviOrder.id,
      zayviOrderNumber: zayviOrder.order_number,
    });
  } catch (error) {
    console.error("PayPal checkout failed", error);
    return NextResponse.json(
      { error: "Checkout is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
}
