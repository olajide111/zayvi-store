"use client";

import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { useState } from "react";
import { contentUrl, type ContentMarket } from "@/lib/storefront-content";

export type GuideSummary = { slug: string; title: string; summary?: string };

export default function GuidesLibrary({ articles, market }: { articles: GuideSummary[]; market: ContentMarket }) {
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = articles.filter(({ title, summary }) => terms.every((term) => `${title} ${summary ?? ""}`.toLowerCase().includes(term)));

  if (!articles.length) return (
    <div className="mt-8 rounded-2xl border border-[#dfe6e1] bg-white p-6 sm:p-8">
      <h2 className="text-xl font-semibold">More to come</h2>
      <p className="mt-2 text-sm text-[#52635b]">No guides have been published for this country yet. You can still browse the store or find help below.</p>
    </div>
  );

  return (
    <section aria-label="Published guides" className="mt-8">
      <label htmlFor="guide-search" className="block text-sm font-semibold">Find a guide</label>
      <div className="relative mt-2 max-w-lg">
        <Search size={18} className="pointer-events-none absolute top-3.5 left-3" aria-hidden="true" />
        <input id="guide-search" type="search" value={query} autoComplete="off" placeholder="Search titles and summaries"
          onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
          className="min-h-12 w-full rounded-xl border border-[#c5d2c8] bg-white py-3 pr-4 pl-10 text-sm" />
      </div>
      <p role="status" className="mt-3 text-sm text-[#52635b]">{matches.length} {matches.length === 1 ? "guide" : "guides"}{terms.length ? " found" : " to explore"}</p>
      {matches.length ? (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {matches.map((entry) => (
            <li key={entry.slug}>
              <Link className="group flex h-full min-w-0 flex-col rounded-2xl border border-[#dfe6e1] bg-white p-6 transition-colors hover:border-[#8ca292] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#215241] sm:p-7" href={contentUrl(market, entry.slug)}>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#52635b]">From the journal</span>
                <h2 className="mt-4 break-words font-serif text-2xl leading-tight text-[#172a21] group-hover:underline">{entry.title}</h2>
                {entry.summary && <p className="mt-3 break-words text-sm leading-6 text-[#52635b]">{entry.summary}</p>}
                <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-[#215241]">Read guide<ArrowUpRight size={16} aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-2xl border border-[#dfe6e1] bg-white p-6">
          <h2 className="font-semibold">No matching guides</h2>
          <p className="mt-2 text-sm text-[#52635b]">Try a different word or browse all published guides.</p>
          <button type="button" onClick={() => setQuery("")} className="mt-3 min-h-11 font-semibold text-[#215241] underline">Clear search</button>
        </div>
      )}
    </section>
  );
}
