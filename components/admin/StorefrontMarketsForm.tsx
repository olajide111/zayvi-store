"use client";

import { ExternalLink, Globe2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { ContentMarket } from "@/lib/storefront-content";
import { marketDetails, marketPath, type StorefrontMarketSettings } from "@/lib/storefront-market";

const marketCodes = ["GB", "NG"] as const;
const settingsUrl = "/api/admin/markets/storefront";

export default function StorefrontMarketsForm() {
  const [saved, setSaved] = useState<StorefrontMarketSettings | null>(null);
  const [draft, setDraft] = useState<StorefrontMarketSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(settingsUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load storefront market settings.");
        const settings = await response.json() as StorefrontMarketSettings;
        setSaved(settings);
        setDraft(settings);
      } catch (error) {
        if (!controller.signal.aborted) setError((error as Error).message);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  function enableMarket(code: ContentMarket, enabled: boolean) {
    if (!draft) return;
    const enabledMarkets = marketCodes.filter((market) =>
      market === code ? enabled : draft.enabledMarkets.includes(market)
    );
    if (!enabledMarkets.length) return;
    setDraft({
      ...draft,
      enabledMarkets,
      defaultMarket: enabledMarkets.includes(draft.defaultMarket) ? draft.defaultMarket : enabledMarkets[0],
    });
    setStatus("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(settingsUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const settings = await response.json();
      if (!response.ok) throw new Error(settings.error || "Unable to save storefront market settings.");
      setSaved(settings);
      setDraft(settings);
      setStatus("Storefront markets saved.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const changed = JSON.stringify(saved) !== JSON.stringify(draft);

  return (
    <section aria-labelledby="selling-countries" className="rounded-2xl border border-[#dce7dc] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Globe2 aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-[#215241]" />
        <div>
          <h2 id="selling-countries" className="text-lg font-semibold">Where you sell</h2>
          <p className="mt-1 text-sm text-[#52635b]">Choose the countries customers can shop in. Each country has its own prices and delivery options.</p>
        </div>
      </div>

      {draft ? (
        <form onSubmit={save} className="mt-5">
          <fieldset disabled={saving} className="grid gap-5">
            <legend className="sr-only">Storefront countries</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {marketCodes.map((code) => {
                const isEnabled = draft.enabledMarkets.includes(code);
                return (
                  <div key={code} className="rounded-xl border border-[#dfe6e1] p-4">
                    <label className="flex min-h-11 items-center gap-3">
                      <input type="checkbox" checked={isEnabled} disabled={isEnabled && draft.enabledMarkets.length === 1}
                        onChange={(event) => enableMarket(code, event.target.checked)} className="size-4 accent-[#215241]" />
                      <span className="text-sm font-medium">{marketDetails[code].name} <span className="font-normal text-[#52635b]">· {marketDetails[code].currency}</span></span>
                    </label>
                    {saved?.enabledMarkets.includes(code) && (
                      <a href={marketPath("/", code)} target="_blank" rel="noreferrer"
                        className="ml-7 inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-[#215241] underline underline-offset-4">
                        Open storefront <ExternalLink size={13} aria-hidden="true" />
                        <span className="sr-only">for {marketDetails[code].name} in a new tab</span>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            <label className="block max-w-sm text-sm font-medium">
              Default country
              <select value={draft.defaultMarket}
                onChange={(event) => {
                  setDraft({ ...draft, defaultMarket: event.target.value as ContentMarket });
                  setStatus("");
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-[#dfe6e1] bg-white px-3">
                {draft.enabledMarkets.map((code) => <option key={code} value={code}>{marketDetails[code].name}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-[#52635b]">Used when a shopper’s country is unknown or outside your markets.</span>
            </label>
            {draft.enabledMarkets.length > 1 && (
              <label className="inline-flex min-h-11 items-center gap-3 text-sm font-medium">
                <input type="checkbox" checked={draft.showSwitcher}
                  onChange={(event) => {
                    setDraft({ ...draft, showSwitcher: event.target.checked });
                    setStatus("");
                  }} className="size-4 accent-[#215241]" />
                Show country switcher to shoppers
              </label>
            )}
          </fieldset>
          <button type="submit" disabled={saving || !changed}
            className="mt-4 min-h-11 rounded-lg bg-[#215241] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save storefront markets"}
          </button>
        </form>
      ) : !error && <p className="mt-4 text-sm text-[#52635b]">Loading storefront countries…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {status && <p role="status" className="mt-3 text-sm text-[#215241]">{status}</p>}
    </section>
  );
}
