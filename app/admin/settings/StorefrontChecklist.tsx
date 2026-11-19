"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { requestContent, setupPageSlugs, type EntrySummary } from "@/lib/admin-content";
import { starterPages, type ContentMarket } from "@/lib/storefront-content";

function MarketChecklist({ market }: { market: ContentMarket }) {
  const [entries, setEntries] = useState<EntrySummary[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    requestContent<{ content: EntrySummary[] }>(`/api/admin/content?market=${market}`, { signal: abort.signal })
      .then(({ content }) => { if (!abort.signal.aborted) setEntries(content); })
      .catch(() => { if (!abort.signal.aborted) setError("Could not load page status."); });
    return () => abort.abort();
  }, [market, attempt]);

  if (error) return (
    <div role="alert" className="mt-4 flex flex-wrap items-center gap-2 text-sm text-red-900">
      <p>{error}</p>
      <button type="button" className="min-h-11 px-2 font-semibold underline" onClick={() => { setError(""); setAttempt((current) => current + 1); }}>Retry</button>
    </div>
  );
  if (!entries) return <p role="status" className="mt-4 text-sm text-[#52635b]">Loading page status…</p>;

  const pages = setupPageSlugs.map((slug) => ({ slug, entry: entries.find((item) => item.slug === slug && item.kind === "page") }));
  const published = pages.filter(({ entry }) => entry?.published_at).length;
  const nextPage = pages.find(({ entry }) => !entry?.published_at) ?? pages.find(({ entry }) => entry?.draft_changed);
  return (
    <div className="mt-4 space-y-4">
      <div>
        <label htmlFor="setup-page-progress" className="text-sm font-semibold">{published} of {pages.length} customer pages published</label>
        <progress id="setup-page-progress" className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-[#e7efe8] [&::-moz-progress-bar]:bg-[#215241] [&::-webkit-progress-bar]:bg-[#e7efe8] [&::-webkit-progress-value]:bg-[#215241]" value={published} max={pages.length} />
        {nextPage ? (
          <Link href={`/admin/content?market=${market}&page=${nextPage.slug}`} prefetch={false}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#215241] px-4 text-sm font-semibold text-white">
            Continue setup: {nextPage.entry?.title ?? starterPages[nextPage.slug].title}<ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : <p className="mt-3 text-sm text-[#215241]">Customer pages are published. Review them when your store policies change.</p>}
      </div>
      <ul className="divide-y divide-[#e4eae5]">
        {pages.map(({ slug, entry }) => {
          const label = entry?.published_at ? entry.draft_changed ? "Published · draft changes" : "Published" : entry ? "Draft saved" : "Needs setup";
          return (
            <li key={slug}>
              <Link href={`/admin/content?market=${market}&page=${slug}`} prefetch={false} className="flex min-h-12 flex-wrap items-center gap-2 rounded-md px-2 py-2 hover:bg-[#f5f8f5]">
                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-[#172a21]">{entry?.title ?? starterPages[slug].title}</span>
                <span className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${entry?.published_at ? "bg-[#edf4ee] text-[#215241]" : "bg-[#f4f1e8] text-[#664f25]"}`}>
                  {entry?.published_at && <CheckCircle2 size={13} aria-hidden="true" />}{label}
                </span>
                <ArrowRight size={15} className="shrink-0 text-[#215241]" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function StorefrontChecklist({ market }: { market: ContentMarket }) {
  return (
    <section aria-labelledby="customer-pages" className="rounded-2xl border border-[#dfe6e1] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="customer-pages" className="text-lg font-semibold tracking-tight">Customer pages</h2>
        <div role="group" aria-label="Checklist market" className="flex flex-wrap gap-1 rounded-lg bg-[#f5f7f3] p-1">
          {(["GB", "NG"] as const).map((code) => (
            <Link key={code} aria-current={code === market ? "page" : undefined} href={`/admin/settings?market=${code}`}
              className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm font-semibold ${code === market ? "bg-[#215241] text-white" : "text-[#215241] hover:bg-white"}`}>
              {code === "GB" ? "United Kingdom" : "Nigeria"}
            </Link>
          ))}
        </div>
      </div>
      <MarketChecklist key={market} market={market} />
    </section>
  );
}
