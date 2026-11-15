"use client";

import { useEffect, useState } from "react";

type Market = {
  code: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  enabled: boolean;
  configurationVersion: number;
};

type MarketsResponse = {
  total: number;
  markets: Market[];
};

export default function AdminMarketsPage() {
  const [data, setData] = useState<MarketsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/markets", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Unable to load markets.");
        return payload;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load markets."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div><div className="text-xs text-gray-400">Workspace / Markets</div><h1 className="mt-1 text-xl font-semibold text-[#17251e]">Markets & Currencies</h1></div>
          <a href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">Back to overview</a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5">
          <div className="text-sm font-semibold text-[#23432d]">Real PostgreSQL market configuration</div>
          <p className="mt-1 text-xs leading-5 text-[#55705b]">These records come directly from the Zayvi commerce market tables in AWS Preview.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Markets configured</div><div className="mt-2 text-3xl font-semibold">{data?.total ?? "—"}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="text-xs text-gray-400">Enabled</div><div className="mt-2 text-3xl font-semibold">{data?.markets.filter((m) => m.enabled).length ?? "—"}</div></div>
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">Loading markets...</div>}
        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {data?.markets.map((market) => (
              <div key={market.code} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-start justify-between">
                  <div><div className="text-xs font-semibold tracking-[0.15em] text-gray-400">{market.code}</div><h2 className="mt-2 text-lg font-semibold">{market.name}</h2></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${market.enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{market.enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="mt-6 space-y-3 border-t border-gray-100 pt-5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Currency</span><span className="font-semibold">{market.currency}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Locale</span><span>{market.locale}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Timezone</span><span>{market.timezone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Config version</span><span>{market.configurationVersion}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
