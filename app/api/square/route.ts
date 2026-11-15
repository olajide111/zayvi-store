import { NextResponse } from "next/server";

// Purchasing is intentionally disabled during the Zayvi preview.
// This server-side gate prevents direct API calls from charging a payment source.
export async function POST() {
  return NextResponse.json(
    { error: "Square payments are disabled while product, market and fulfilment data are being verified." },
    { status: 503 }
  );
}
