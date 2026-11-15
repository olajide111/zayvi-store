import { NextResponse } from "next/server";

// Purchasing is intentionally disabled during the Zayvi preview.
// This server-side gate prevents direct API calls from creating payment orders.
export async function POST() {
  return NextResponse.json(
    { error: "PayPal checkout is disabled while product, market and fulfilment data are being verified." },
    { status: 503 }
  );
}
