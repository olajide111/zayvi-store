import { NextResponse } from "next/server";

// Purchasing is intentionally disabled during the Zayvi catalogue and market
// verification preview. Keep the server-side gate even when a payment provider
// is configured; browser-only disabled buttons are not a security control.
export async function POST() {
  return NextResponse.json(
    { error: "Checkout is temporarily unavailable while product, market and fulfilment data are being verified." },
    { status: 503 }
  );
}
