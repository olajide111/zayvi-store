import { NextRequest, NextResponse } from "next/server";

import {
  getPaymentByExternalId,
  getStoredOrder,
  markPaymentAndOrderPaid,
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

  if (!response.ok) throw new Error("Could not authenticate with PayPal.");

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("PayPal did not return an access token.");
  }

  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paypalOrderId =
      typeof body.orderId === "string" ? body.orderId.trim() : "";
    const zayviOrderId =
      typeof body.zayviOrderId === "string" ? body.zayviOrderId.trim() : "";

    if (!paypalOrderId || !zayviOrderId) {
      return NextResponse.json(
        { error: "Valid PayPal and ZAYVI order references are required." },
        { status: 400 }
      );
    }

    const [zayviOrder, storedPayment] = await Promise.all([
      getStoredOrder(zayviOrderId),
      getPaymentByExternalId("paypal", paypalOrderId),
    ]);

    if (!zayviOrder || !storedPayment || storedPayment.order_id !== zayviOrder.id) {
      return NextResponse.json(
        { error: "This PayPal payment is not linked to the ZAYVI order." },
        { status: 400 }
      );
    }

    if (storedPayment.status === "paid" && zayviOrder.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        orderId: paypalOrderId,
        zayviOrderId: zayviOrder.id,
        zayviOrderNumber: zayviOrder.order_number,
        amount: (storedPayment.amount_minor / 100).toFixed(2),
        currency: storedPayment.currency,
      });
    }

    const accessToken = await getAccessToken();
    const response = await fetch(
      PAYPAL_BASE +
        "/v2/checkout/orders/" +
        encodeURIComponent(paypalOrderId) +
        "/capture",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
          "PayPal-Request-Id": "capture-" + zayviOrder.order_number,
        },
        body: "{}",
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (
      !response.ok &&
      result?.details?.[0]?.issue !== "ORDER_ALREADY_CAPTURED"
    ) {
      console.error("PayPal capture rejected", {
        status: response.status,
        issue: result?.name,
      });
      return NextResponse.json(
        {
          error:
            "PayPal could not confirm this payment. Please contact support before trying again.",
        },
        { status: 402 }
      );
    }

    let paypalOrder = result;

    if (
      result?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED" ||
      result?.status !== "COMPLETED"
    ) {
      const lookup = await fetch(
        PAYPAL_BASE +
          "/v2/checkout/orders/" +
          encodeURIComponent(paypalOrderId),
        {
          headers: { Authorization: "Bearer " + accessToken },
          cache: "no-store",
        }
      );

      paypalOrder = await lookup.json();
      if (!lookup.ok) {
        throw new Error("Could not verify the PayPal order status.");
      }
    }

    if (paypalOrder?.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal has not marked this payment as completed." },
        { status: 402 }
      );
    }

    const unit = paypalOrder.purchase_units?.[0];
    const captureDetails = unit?.payments?.captures?.[0];
    const paidCurrency = captureDetails?.amount?.currency_code;
    const paidValue = captureDetails?.amount?.value;
    const paidMinor =
      typeof paidValue === "string"
        ? Math.round(Number(paidValue) * 100)
        : NaN;

    if (
      !captureDetails ||
      captureDetails.status !== "COMPLETED" ||
      paidCurrency !== zayviOrder.currency ||
      paidCurrency !== storedPayment.currency ||
      paidMinor !== zayviOrder.total_minor ||
      paidMinor !== storedPayment.amount_minor ||
      unit?.invoice_id !== zayviOrder.order_number
    ) {
      console.error("PayPal payment/order mismatch", {
        paypalOrderId,
        zayviOrderId,
        paidCurrency,
        paidMinor,
      });
      return NextResponse.json(
        {
          error:
            "The payment amount or order reference does not match ZAYVI's records. Please contact support.",
        },
        { status: 402 }
      );
    }

    const paidAt = new Date().toISOString();
    await markPaymentAndOrderPaid({
      paymentId: storedPayment.id,
      orderId: zayviOrder.id,
      paidAt,
    });

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      orderId: paypalOrder.id,
      zayviOrderId: zayviOrder.id,
      zayviOrderNumber: zayviOrder.order_number,
      captureId: captureDetails.id,
      amount: paidValue,
      currency: paidCurrency,
    });
  } catch (error) {
    console.error("PayPal capture error", error);
    return NextResponse.json(
      {
        error:
          "We could not verify your payment just now. Please contact support before placing another order.",
      },
      { status: 500 }
    );
  }
}
