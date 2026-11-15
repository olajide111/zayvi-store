import { NextRequest, NextResponse } from "next/server";

import {
  getPaymentByExternalId,
  getStoredOrder,
  markPaymentAndOrderPaid,
} from "@/lib/database/orders";

const SQUARE_API_VERSION = "2026-09-16";

export async function POST(req: NextRequest) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment =
    process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

  if (!accessToken) {
    return NextResponse.json(
      { error: "Square payment verification is not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const paymentId =
      typeof body.paymentId === "string" ? body.paymentId.trim() : "";
    const zayviOrderId =
      typeof body.zayviOrderId === "string" ? body.zayviOrderId.trim() : "";

    if (!paymentId || !zayviOrderId) {
      return NextResponse.json(
        { error: "Square and ZAYVI payment references are required." },
        { status: 400 }
      );
    }

    const [zayviOrder, storedPayment] = await Promise.all([
      getStoredOrder(zayviOrderId),
      getPaymentByExternalId("square", paymentId),
    ]);

    if (
      !zayviOrder ||
      !storedPayment ||
      storedPayment.order_id !== zayviOrder.id
    ) {
      return NextResponse.json(
        { error: "This Square payment is not linked to the ZAYVI order." },
        { status: 400 }
      );
    }

    if (
      storedPayment.status === "paid" &&
      zayviOrder.payment_status === "paid"
    ) {
      return NextResponse.json({
        success: true,
        paymentId,
        zayviOrderId: zayviOrder.id,
        zayviOrderNumber: zayviOrder.order_number,
        amount: (storedPayment.amount_minor / 100).toFixed(2),
        currency: storedPayment.currency,
        status: "COMPLETED",
      });
    }

    const apiBase =
      environment === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";

    const response = await fetch(
      apiBase + "/v2/payments/" + encodeURIComponent(paymentId),
      {
        headers: {
          Authorization: "Bearer " + accessToken,
          "Square-Version": SQUARE_API_VERSION,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Square could not verify this payment." },
        { status: 402 }
      );
    }

    const payment = data.payment;
    const paidAmount = Number(payment?.amount_money?.amount);
    const paidCurrency = payment?.amount_money?.currency;

    if (
      !payment ||
      payment.status !== "COMPLETED" ||
      !Number.isSafeInteger(paidAmount) ||
      paidAmount !== zayviOrder.total_minor ||
      paidAmount !== storedPayment.amount_minor ||
      paidCurrency !== zayviOrder.currency ||
      paidCurrency !== storedPayment.currency ||
      payment.reference_id !== zayviOrder.order_number
    ) {
      console.error("Square payment/order mismatch", {
        paymentId,
        zayviOrderId,
        paidAmount,
        paidCurrency,
      });

      return NextResponse.json(
        {
          error:
            "The Square payment does not match ZAYVI's stored order. Please contact support.",
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
      paymentId: payment.id,
      zayviOrderId: zayviOrder.id,
      zayviOrderNumber: zayviOrder.order_number,
      amount: (paidAmount / 100).toFixed(2),
      currency: paidCurrency,
      status: payment.status,
    });
  } catch (error) {
    console.error("Square verification failed", error);
    return NextResponse.json(
      {
        error:
          "We could not verify your Square payment. Please contact support.",
      },
      { status: 500 }
    );
  }
}
