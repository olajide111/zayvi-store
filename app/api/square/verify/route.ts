import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  if (!accessToken) return NextResponse.json({ error: "Square payment verification is not configured." }, { status: 503 });

  try {
    const body = await req.json();
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
    if (!paymentId) return NextResponse.json({ error: "A Square payment reference is required." }, { status: 400 });

    const apiBase = environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
    const response = await fetch(apiBase + "/v2/payments/" + encodeURIComponent(paymentId), {
      headers: {
        Authorization: "Bearer " + accessToken,
        "Square-Version": "2024-01-18",
      },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: "Square could not verify this payment." }, { status: 402 });
    }

    const payment = data.payment;
    if (!payment || payment.status !== "COMPLETED" || payment.amount_money?.currency !== "GBP") {
      return NextResponse.json({ error: "Square has not confirmed this payment as completed." }, { status: 402 });
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      amount: (payment.amount_money.amount / 100).toFixed(2),
      currency: payment.amount_money.currency,
      status: payment.status,
    });
  } catch (error) {
    console.error("Square verification failed", error);
    return NextResponse.json({ error: "We could not verify your Square payment. Please contact support." }, { status: 500 });
  }
}
