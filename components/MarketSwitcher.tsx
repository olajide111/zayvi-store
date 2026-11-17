"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ContentMarket } from "@/lib/storefront-content";
import { marketDetails, type StorefrontMarketSettings } from "@/lib/storefront-market";

export default function MarketSwitcher({ market, settings, guides = false }: {
  market: ContentMarket;
  settings: StorefrontMarketSettings;
  guides?: boolean;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const canSwitch = settings.showSwitcher && settings.enabledMarkets.length > 1;

  useEffect(() => {
    if (!canSwitch) return;

    function dismissOutside(event: PointerEvent) {
      const details = disclosure.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    }

    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [canSwitch]);

  if (!canSwitch) return null;

  return (
    <nav aria-label="Shipping country" className={guides ? "ml-auto text-xs" : "text-xs"}>
      <details ref={disclosure} className="group relative"
        onBlur={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
            event.currentTarget.open = false;
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !event.currentTarget.open) return;
          event.preventDefault();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }}>
        <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 [&::-webkit-details-marker]:hidden ${guides ? "hover:bg-[#edf4ee]" : "hover:bg-white/10"}`}>
          <span>Ship to</span>
          <span className="font-semibold">{marketDetails[market].name}</span>
          <ChevronDown size={14} aria-hidden="true" className="motion-safe:transition-transform group-open:rotate-180" />
        </summary>
        <form action="/storefront/change-market" method="post"
          className={`absolute top-full z-[910] mt-1 w-48 rounded-lg border border-[#dfe6e1] bg-white p-1.5 text-[#172a21] shadow-lg ${guides ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
          {guides && <input type="hidden" name="from" value="guides" />}
          {settings.enabledMarkets.filter((code) => code !== market).map((code) => (
            <button key={code} type="submit" name="market" value={code}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left font-semibold hover:bg-[#edf4ee] focus-visible:outline-2 focus-visible:outline-[#215241]">
              <span>{marketDetails[code].name}</span>
              <span className="font-normal text-[#52635b]">{marketDetails[code].currency}</span>
            </button>
          ))}
        </form>
      </details>
    </nav>
  );
}
