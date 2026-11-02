import { NextRequest, NextResponse } from "next/server";

const PAYPAL_BASE = "https://api-m.paypal.com";

async function getAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;
  if (!clientId || !secret) throw new Error("PayPal is not configured.");
  const auth = Buffer.from(\`\${clientId}:\${secret}\`).toString("base64");
  const response = await fetch(\`\${PAYPAL_BASE}/v1/oauth2/token\`, {
    method: "POST",
    headers: {
      Authorization: \`Basic \${auth}\`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not authenticate with PayPal.");
  const data = await response.json();
  if (!data.access_token) throw new Error("PayPal did not return an access token.");
  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId || !/^[A-Z0-9-]{8,}$/i.test(orderId)) {
      return NextResponse.json({ error: "A valid PayPal order reference is required." }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    const response = await fetch(\`\${PAYPAL_BASE}/v2/checkout/orders/\${encodeURIComponent(orderId)}/capture\`, {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${accessToken}\`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok && result?.details?.[0]?.issue !== "ORDER_ALREADY_CAPTURED") {
      console.error("PayPal capture rejected", { status: response.status, issue: result?.name });
      return NextResponse.json({ error: "PayPal could not confirm this payment. Please contact support before trying again." }, { status: 402 });
    }

    let order = result;
    if (result?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED" || result?.status !== "COMPLETED") {
      const lookup = await fetch(\`\${PAYPAL_BASE}/v2/checkout/orders/\${encodeURIComponent(orderId)}\`, {
        headers: { Authorization: \`Bearer \${accessToken}\` },
        cache: "no-store",
      });
      order = await lookup.json();
      if (!lookup.ok) throw new Error("Could not verify the PayPal order status.");
    }

    if (order?.status !== "COMPLETED") {
      return NextResponse.json({ error: "PayPal has not marked this payment as completed." }, { status: 402 });
    }

    const unit = order.purchase_units?.[0];
    const captureDetails = unit?.payments?.captures?.[0];
    if (!captureDetails || captureDetails.status !== "COMPLETED" || captureDetails.amount?.currency_code !== "GBP") {
      return NextResponse.json({ error: "The payment could not be verified. Please contact support." }, { status: 402 });
    }

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      orderId: order.id,
      captureId: captureDetails.id,
      amount: captureDetails.amount.value,
      currency: captureDetails.amount.currency_code,
    });
  } catch (error) {
    console.error("PayPal capture error", error);
    return NextResponse.json(
      { error: "We could not verify your payment just now. Please contact support before placing another order." },
      { status: 500 }
    );
  }
}
