import Link from "next/link";
import MarketSwitcher from "./MarketSwitcher";
import { marketPath, type StorefrontMarketSettings } from "@/lib/storefront-market";
import { contentUrl, type ContentMarket } from "@/lib/storefront-content";

export default function ReadingNav({ market, settings, index = false }: { market: ContentMarket; settings: StorefrontMarketSettings; index?: boolean }) {
  return (
    <header className="border-b border-[#dfe6e1] bg-white">
      <nav aria-label="Storefront" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2 sm:px-8">
        <div className="flex items-center gap-4">
          <Link className="py-2 text-lg font-black tracking-tight text-[#172a21]" href={marketPath("/", market)}>ZAYVI<span className="text-[#215241]">.</span></Link>
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#215241] hover:underline" href={marketPath("/", market)}>Shop</Link>
          <Link className="py-2 text-sm font-semibold text-[#215241] hover:underline" aria-current={index ? "page" : undefined} href={contentUrl(market)}>Blog &amp; guides</Link>
        </div>
        <MarketSwitcher market={market} settings={settings} guides />
      </nav>
    </header>
  );
}
