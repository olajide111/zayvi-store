import type { ContentMarket } from "@/lib/storefront-content";
import { marketDetails, type StorefrontMarketSettings } from "@/lib/storefront-market";

export default function MarketSwitcher({ market, settings, guides = false }: {
  market: ContentMarket;
  settings: StorefrontMarketSettings;
  guides?: boolean;
}) {
  if (!settings.showSwitcher || settings.enabledMarkets.length < 2) return null;

  return (
    <nav aria-label="Shipping country" className="flex flex-wrap items-center gap-2 text-xs">
      <span>Ship to</span>
      {settings.enabledMarkets.map((code) => (
        code === market
          ? <span key={code} aria-current="true" className="rounded-md bg-white/15 px-2 py-2 font-semibold">{marketDetails[code].name}</span>
          : <form key={code} action="/storefront/change-market" method="post">
              {guides && <input type="hidden" name="from" value="guides" />}
              <button type="submit" name="market" value={code}
                className="min-h-11 rounded-md px-2 underline underline-offset-4">
                {marketDetails[code].name}
              </button>
            </form>
      ))}
    </nav>
  );
}
