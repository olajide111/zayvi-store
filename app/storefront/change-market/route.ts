import { NextRequest, NextResponse } from "next/server";
import { loadStorefrontMarkets, marketCookie } from "@/lib/storefront-market-server";
import { marketCode, marketPath } from "@/lib/storefront-market";

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid market selection." }, { status: 400 });
  }
  const market = marketCode(form.get("market"));
  const settings = await loadStorefrontMarkets();

  if (!settings) return NextResponse.json({ error: "Storefront markets are unavailable." }, { status: 503 });
  if (!market || !settings.enabledMarkets.includes(market)) {
    return NextResponse.json({ error: "This store does not sell in the selected market." }, { status: 404 });
  }

  const path = form.get("from") === "guides" ? "/read" : "/";
  const response = NextResponse.redirect(new URL(marketPath(path, market), request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(marketCookie, market, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
