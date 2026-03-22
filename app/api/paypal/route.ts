import { NextRequest, NextResponse } from "next/server";

const PAYPAL_BASE = "https://api-m.paypal.com";

async function getAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();
    const total = items.reduce((sum: number, item: any) => sum + item.price * item.qty, 0);
    const accessToken = await getAccessToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "GBP",
            value: total.toFixed(2),
          },
          description: "ZAYVI Order",
        }],
        application_context: {
          return_url: `${process.env.NEXT_PUBLIC_STORE_URL}/success`,
          cancel_url: process.env.NEXT_PUBLIC_STORE_URL,
          brand_name: "ZAYVI",
          user_action: "PAY_NOW",
        },
      }),
    });

    const order = await res.json();
    const approveLink = order.links?.find((l: any) => l.rel === "approve")?.href;
    return NextResponse.json({ url: approveLink });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}