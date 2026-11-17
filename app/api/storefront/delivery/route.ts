import { NextRequest, NextResponse } from "next/server";
import { storefrontApiMarket } from "@/lib/storefront-market-server";
import { callZayviAwsApi } from "@/lib/aws-api";
import { isDeliveryQuote } from "@/lib/delivery";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const selection = await storefrontApiMarket(request.nextUrl.searchParams.get("market"));
  if (selection.error) return selection.error;
  const { market: marketCode } = selection;

  if (process.env.VERCEL_ENV !== "production") {
    const result = await callZayviAwsApi(`/delivery-settings?market=${marketCode}`);
    if (result.ok && isDeliveryQuote(result.data, marketCode)) {
      return NextResponse.json(result.data, { headers: { "cache-control": "no-store" } });
    }
  }

  return NextResponse.json({ error: "Preview delivery setup is unavailable." }, { status: 503 });
}
