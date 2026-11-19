import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { callZayviAwsApi } from "./aws-api";
import { marketCode, selectStorefrontMarket, type StorefrontMarketSettings } from "./storefront-market";

export const marketCookie = "zayvi-shopping-market";

export async function loadStorefrontMarkets(): Promise<StorefrontMarketSettings | null> {
  const result = await callZayviAwsApi("/storefront-market-settings");
  if (!result.ok) {
    const data = result.data as { error?: string; code?: string } | null;
    // The website and the Preview API are deployed independently.
    if ((result.status === 404 && data?.error === "not_found") ||
        (result.status === 409 && data?.code === "schema_not_ready")) {
      return { enabledMarkets: ["GB", "NG"], defaultMarket: "GB", showSwitcher: true };
    }
    return null;
  }

  const data = result.data as Partial<StorefrontMarketSettings> | null;
  const defaultMarket = marketCode(data?.defaultMarket);
  if (!defaultMarket || typeof data?.showSwitcher !== "boolean" || !Array.isArray(data.enabledMarkets)) return null;

  const enabledMarkets = data.enabledMarkets.filter((code) => code === "GB" || code === "NG");
  if (!enabledMarkets.includes(defaultMarket)) return null;

  return { defaultMarket, enabledMarkets, showSwitcher: data.showSwitcher };
}

export async function resolveStorefrontMarket(requested: unknown) {
  const [settings, browserCookies, requestHeaders] = await Promise.all([
    loadStorefrontMarkets(),
    cookies(),
    headers(),
  ]);
  if (!settings) throw new Error("Storefront markets are temporarily unavailable.");

  const explicit = marketCode(requested);
  const market = explicit
    ? selectStorefrontMarket(settings, explicit)
    : selectStorefrontMarket(settings, browserCookies.get(marketCookie)?.value, requestHeaders.get("x-vercel-ip-country"));

  return { market, settings, unavailable: Boolean(explicit && !settings.enabledMarkets.includes(explicit)) };
}

export async function storefrontApiMarket(requested: unknown) {
  const explicit = marketCode(requested);
  if (requested != null && !explicit) {
    return { error: NextResponse.json({ error: "Unsupported market." }, { status: 400 }) } as const;
  }

  const settings = await loadStorefrontMarkets();
  if (!settings) {
    return { error: NextResponse.json({ error: "Storefront market settings are unavailable." }, { status: 503 }) } as const;
  }
  if (explicit && !settings.enabledMarkets.includes(explicit)) {
    return { error: NextResponse.json({ error: "This store does not sell in the selected market." }, { status: 404 }) } as const;
  }
  return { market: explicit ?? settings.defaultMarket } as const;
}
