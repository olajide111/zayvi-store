import type { ContentMarket } from "./storefront-content";

export type StorefrontMarketSettings = {
  enabledMarkets: ContentMarket[];
  defaultMarket: ContentMarket;
  showSwitcher: boolean;
};

export const marketDetails = {
  GB: { name: "United Kingdom", currency: "GBP" },
  NG: { name: "Nigeria", currency: "NGN" },
} as const;

export function marketCode(value: unknown): ContentMarket | undefined {
  const code = typeof value === "string" ? value.toUpperCase() : "";
  return code === "GB" || code === "NG" ? code : undefined;
}

export function selectStorefrontMarket(
  settings: StorefrontMarketSettings,
  ...candidates: unknown[]
): ContentMarket {
  for (const candidate of candidates) {
    const code = marketCode(candidate);
    if (code && settings.enabledMarkets.includes(code)) return code;
  }
  return settings.defaultMarket;
}

export function cartStorageKey(market: ContentMarket) {
  return `zayvi-cart-v2-${market}`;
}

export function marketPath(path: string, market: ContentMarket) {
  return `${path}?market=${market}`;
}

export function productPath(id: string, market?: string) {
  const path = `/product/${encodeURIComponent(id)}`;
  const code = marketCode(market);
  return code ? marketPath(path, code) : path;
}
