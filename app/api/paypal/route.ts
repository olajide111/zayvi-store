import { NextRequest, NextResponse } from "next/server";
import { priceCart } from "@/lib/products";

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
    let total: number;
    try {
      total = priceCart(items).total; // prices from the catalogue, never from the browser
    } catch (e) {
      return NextResponse.json({ error: (e instanceof Error ? e.message : "Your basket could not be checked.") }, { status: 400 });
    }
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
    const approveLink = order.links?.find((l: { rel: string; href: string }) => l.rel === "approve")?.href;
    if (!approveLink) throw new Error(`PayPal did not return an approval link (${res.status})`);
    return NextResponse.json({ url: approveLink });
  } catch (err) {
    console.error("PayPal checkout failed", err);
    return NextResponse.json({ error: "Checkout is unavailable right now. Please try again." }, { status: 500 });
  }
}