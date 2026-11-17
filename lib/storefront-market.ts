import type { ContentMarket } from "./storefront-content";

export function storefrontMarket(value?: string | string[]): ContentMarket {
  return typeof value === "string" && value.toUpperCase() === "NG" ? "NG" : "GB";
}

export function cartStorageKey(market: ContentMarket) {
  return `zayvi-cart-v2-${market}`;
}

export function productPath(id: string, market?: string) {
  return `/product/${encodeURIComponent(id)}${market === "NG" ? "?market=NG" : ""}`;
}
