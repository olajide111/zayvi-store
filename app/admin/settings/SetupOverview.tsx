"use client";

import Link from "next/link";
import { Globe2, Link2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { marketDetails, type StorefrontMarketSettings } from "@/lib/storefront-market";
import { parseSocialLinks, socialPlatforms, socialProfiles, type SocialLinks } from "@/lib/social-links";

type Loaded<T> = { data: T; error?: never } | { error: string; data?: never };
type Snapshot = {
  revision: number;
  markets: Loaded<StorefrontMarketSettings>;
  social: Loaded<SocialLinks>;
};

async function load<T>(url: string, signal: AbortSignal, parse: (value: unknown) => T): Promise<Loaded<T>> {
  try {
    const response = await fetch(url, { cache: "no-store", signal });
    if (response.status === 401) throw new Error("Your session has expired. Sign in again to check settings.");
    if (!response.ok) throw new Error("Settings are unavailable. Try refreshing or check System Readiness.");
    return { data: parse(await response.json()) };
  } catch (error) {
    return { error: signal.aborted ? "Settings took too long to load. Try refreshing." : error instanceof Error ? error.message : "Settings are unavailable." };
  }
}

function parseMarkets(value: unknown): StorefrontMarketSettings {
  const settings = value as StorefrontMarketSettings | null;
  if (!settings || !Array.isArray(settings.enabledMarkets) || !settings.enabledMarkets.length ||
    settings.enabledMarkets.some((code) => code !== "GB" && code !== "NG") ||
    !settings.enabledMarkets.includes(settings.defaultMarket) || typeof settings.showSwitcher !== "boolean") {
    throw new Error("Saved selling countries could not be read. Check Markets.");
  }
  return settings;
}

export default function SetupOverview() {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current = snapshot?.revision === revision ? snapshot : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    async function refresh() {
      const [markets, social] = await Promise.all([
        load("/api/admin/markets/storefront", controller.signal, parseMarkets),
        load("/api/admin/social-links", controller.signal, (value) => parseSocialLinks((value as { links?: unknown } | null)?.links)),
      ]);
      window.clearTimeout(timeout);
      if (active) setSnapshot({ revision, markets, social });
    }
    void refresh();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [revision]);

  const markets = current?.markets.data;
  const links = current?.social.data;
  const linkedPlatforms = links ? socialPlatforms.filter((platform) => Boolean(links[platform])) : [];
  const panel = "min-w-0 rounded-2xl border border-[#dfe6e1] bg-white p-4 sm:p-5";

  return (
    <section aria-labelledby="saved-setup-heading" className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-7 lg:px-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="saved-setup-heading" className="text-lg font-semibold tracking-tight">Your saved setup</h2>
        <button type="button" disabled={!current} onClick={() => setRevision((value) => value + 1)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#215241] hover:bg-[#edf4ee] disabled:opacity-50">
          <RefreshCw size={15} aria-hidden="true" />{current ? "Refresh setup" : "Checking settings…"}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section aria-labelledby="saved-markets-heading" className={panel}>
          <h3 id="saved-markets-heading" className="flex items-center gap-2 font-semibold"><Globe2 size={18} aria-hidden="true" />Selling countries</h3>
          {!current ? <p role="status" className="mt-2 text-sm">Loading saved countries…</p> : markets ? (
            <>
              <p className="mt-2 text-sm">{markets.enabledMarkets.map((code) => marketDetails[code].name).join(" · ")}</p>
              <p className="mt-1 text-sm text-[#52635b]">Default: {marketDetails[markets.defaultMarket].name} · {marketDetails[markets.defaultMarket].currency}</p>
              <p className="mt-1 text-sm text-[#52635b]">{markets.enabledMarkets.length > 1 && markets.showSwitcher ? "Shoppers can switch between your enabled countries." : "The country switcher is hidden from shoppers."}</p>
            </>
          ) : <p role="alert" className="mt-2 text-sm text-red-800">Unavailable — {current.markets.error}</p>}
          <Link href="/admin/markets" prefetch={false} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[#215241] underline">Manage selling countries</Link>
        </section>
        <section aria-labelledby="saved-social-heading" className={panel}>
          <h3 id="saved-social-heading" className="flex items-center gap-2 font-semibold"><Link2 size={18} aria-hidden="true" />Social profiles <span className="text-xs font-normal text-[#52635b]">Optional</span></h3>
          {!current ? <p role="status" className="mt-2 text-sm">Loading saved profiles…</p> : links ? (
            <>
              <p className="mt-2 text-sm">{linkedPlatforms.length ? `${linkedPlatforms.length} ${linkedPlatforms.length === 1 ? "profile" : "profiles"} linked` : "No social profiles linked"}</p>
              <p className="mt-1 text-sm text-[#52635b]">{linkedPlatforms.length ? linkedPlatforms.map((platform) => socialProfiles[platform].label).join(" · ") : "The social section stays hidden until you add a profile link."}</p>
            </>
          ) : <p role="alert" className="mt-2 text-sm text-red-800">Unavailable — {current.social.error}</p>}
          <Link href="/admin/settings/social-links" prefetch={false} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[#215241] underline">Manage social links</Link>
        </section>
      </div>
    </section>
  );
}
