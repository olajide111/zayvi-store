"use client";

import Link from "next/link";
import { useState, type RefObject } from "react";
import { FileText, PenLine, Search } from "lucide-react";
import { adminAction, adminPrimaryAction } from "@/components/admin/AdminPageHeading";
import { type EntrySummary } from "@/lib/admin-content";
import { contentUrl, starterPages, type ContentKind, type ContentMarket } from "@/lib/storefront-content";

export function publicationStatus(entry: EntrySummary) {
  if (!entry.published_at) return "Draft";
  return entry.draft_changed ? "Published · draft changes" : "Published";
}

export default function ContentLibrary({ entries, market, busy, selectedSlug, headingRef, onStart, onOpen }: {
  entries: EntrySummary[];
  market: ContentMarket;
  busy: boolean;
  selectedSlug?: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onStart: (kind: ContentKind, slug?: string) => void;
  onOpen: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const search = query.trim().toLocaleLowerCase();
  const results = entries.filter((entry) =>
    (!search || entry.title.toLocaleLowerCase().includes(search) || entry.slug.includes(search)) &&
      (status === "all" ||
        (status === "draft" && !entry.published_at) ||
        (status === "published" && entry.published_at) ||
        (status === "changes" && entry.published_at && entry.draft_changed)),
  );
  const hasFilters = Boolean(search || status !== "all");
  const starters = Object.entries(starterPages).filter(([slug]) => !entries.some((entry) => entry.slug === slug));

  return (
    <section aria-labelledby="content-list" className="min-w-0 rounded-2xl border border-[#dfe6e1] bg-white p-4">
      <h2 id="content-list" ref={headingRef} tabIndex={-1} className="scroll-mt-4 font-semibold">Pages and articles</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={adminPrimaryAction} disabled={busy} onClick={() => onStart("article")}><PenLine size={15} className="mr-2" aria-hidden="true" />New article</button>
        <button type="button" className={adminAction} disabled={busy} onClick={() => onStart("page")}>New page</button>
      </div>
      <Link href={contentUrl(market)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[#215241] underline">
        View Blog &amp; guides
      </Link>

      {entries.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-[#e4eae5] pt-3">
          <label className="relative block">
            <span className="sr-only">Search saved content</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 text-[#52635b]" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or slug"
              className="min-h-11 w-full rounded-lg border border-[#9eafa3] bg-white px-3 pl-9 text-base" />
          </label>
          <label className="block text-xs font-semibold text-[#52635b]">Publication status
            <select className="mt-1 block min-h-11 w-full rounded-lg border border-[#9eafa3] bg-white px-3 text-sm text-[#172a21]"
              value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Unpublished drafts</option>
              <option value="published">Published</option>
              <option value="changes">Published with draft changes</option>
            </select>
          </label>
          {hasFilters && (
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#52635b]">
              <p role="status">{results.length} of {entries.length} items</p>
              <button type="button" className="min-h-9 rounded-md px-1 font-semibold text-[#215241] underline" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</button>
            </div>
          )}
          {!results.length && <p className="py-2 text-sm text-[#52635b]">No saved content matches.</p>}
        </div>
      )}

      {(["article", "page"] as const).map((kind) => {
        const items = results.filter((entry) => entry.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind} className="mt-3">
            <h3 className="text-sm font-semibold">{kind === "article" ? "Articles" : "Pages"}</h3>
            <ul className="mt-1 divide-y divide-[#e4eae5]">
              {items.map((entry) => (
                <li key={entry.slug}>
                  <button type="button" disabled={busy} onClick={() => onOpen(entry.slug)} aria-pressed={selectedSlug === entry.slug}
                    className="block min-h-11 w-full break-words rounded-md px-2 py-2 text-left text-sm text-[#215241] hover:bg-[#f4f7f4] aria-pressed:bg-[#edf4ee]">
                    <span className="block font-semibold">{entry.title}</span>
                    <span className="text-xs text-[#52635b]">{publicationStatus(entry)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {starters.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold">Starter pages</h3>
          <div className="mt-2 grid gap-1">
            {starters.map(([slug, page]) => (
              <button type="button" key={slug} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm text-[#215241] hover:bg-[#edf4ee] disabled:opacity-50"
                disabled={busy} onClick={() => onStart("page", slug)}>
                <FileText size={14} aria-hidden="true" className="shrink-0" />{page.title}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
