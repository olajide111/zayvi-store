import { NextRequest, NextResponse } from "next/server";
import { callZayviAwsApi } from "@/lib/aws-api";
import { isDeliveryQuote } from "@/lib/delivery";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const marketCode = request.nextUrl.searchParams.get("market") || "GB";
  if (marketCode !== "GB" && marketCode !== "NG") {
    return NextResponse.json({ error: "Unsupported delivery market." }, { status: 400 });
  }

  if (process.env.VERCEL_ENV !== "production") {
    const result = await callZayviAwsApi(`/delivery-settings?market=${marketCode}`);
    if (result.ok && isDeliveryQuote(result.data, marketCode)) {
      return NextResponse.json(result.data, { headers: { "cache-control": "no-store" } });
    }
  }

  return NextResponse.json({ error: "Preview delivery setup is unavailable." }, { status: 503 });
}
