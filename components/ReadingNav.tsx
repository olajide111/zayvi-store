import Link from "next/link";
import { contentUrl, type ContentMarket } from "@/lib/storefront-content";

export default function ReadingNav({ market, index = false }: { market: ContentMarket; index?: boolean }) {
  return (
    <header className="border-b border-[#dfe6e1] bg-white">
      <nav aria-label="Storefront" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2 sm:px-8">
        <div className="flex items-center gap-4">
          <Link className="py-2 text-lg font-black tracking-tight text-[#172a21]" href={market === "NG" ? "/?market=NG" : "/"}>ZAYVI<span className="text-[#215241]">.</span></Link>
          <Link className="py-2 text-sm font-semibold text-[#215241] hover:underline" aria-current={index ? "page" : undefined} href={contentUrl(market)}>Blog &amp; guides</Link>
        </div>
        <div role="group" aria-label="Guide markets" className="flex items-center gap-1 rounded-lg bg-[#f5f7f3] p-1">
          {(["GB", "NG"] as const).map((locale) => {
            const label = locale === "GB" ? "UK" : "Nigeria";
            return locale === market
              ? <span key={locale} aria-current="true" className="rounded-md bg-[#215241] px-2 py-1 text-xs font-semibold text-white">{label}</span>
              : <Link key={locale} className="rounded-md px-2 py-1 text-xs font-semibold text-[#215241] hover:underline" href={contentUrl(locale)}>{label}</Link>;
          })}
        </div>
      </nav>
    </header>
  );
}
