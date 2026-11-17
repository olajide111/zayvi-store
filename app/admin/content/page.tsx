"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import AdminPageHeading, { adminAction, adminPrimaryAction } from "@/components/admin/AdminPageHeading";
import { contentUrl, starterPages, type ContentKind, type ContentMarket } from "@/lib/storefront-content";

type EntrySummary = {
  slug: string;
  kind: ContentKind;
  title: string;
  revision: number;
  draft_changed: boolean;
  published_at: string | null;
};

type Draft = { slug: string; kind: ContentKind; title: string; summary: string; body: string; revision: number };
const newDraft: Draft = { slug: "", kind: "page", title: "", summary: "", body: "", revision: 0 };
const field = "mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-[#9eafa3] bg-white px-3 py-2 text-base";

function slugFromTitle(title: string) {
  return title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 80).replace(/-+$/, "");
}

async function requestContent<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (response.status === 401) window.location.replace("/admin");
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Content workspace unavailable.");
  return result;
}

function status(entry: EntrySummary) {
  if (!entry.published_at) return "Draft";
  return entry.draft_changed ? "Published · draft changes" : "Published";
}

function ContentEditor({ market, dirty, setDirty }: {
  market: ContentMarket;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}) {
  const [entries, setEntries] = useState<EntrySummary[] | null>(null);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [customSlug, setCustomSlug] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const url = `/api/admin/content?market=${market}`;
  const selected = entries?.find((entry) => entry.slug === draft.slug);

  useEffect(() => {
    const abort = new AbortController();
    requestContent<{ content: EntrySummary[] }>(url, { signal: abort.signal })
      .then((result) => { if (!abort.signal.aborted) setEntries(result.content); })
      .catch((err: Error) => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [url]);

  function change(update: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...update }));
    setDirty(true);
    setNotice("");
  }

  function changeTitle(title: string) {
    change(!draft.revision && !customSlug ? { title, slug: slugFromTitle(title) } : { title });
  }

  function start(kind: ContentKind, slug = "") {
    const starter = starterPages[slug];
    setCustomSlug(Boolean(starter));
    setDraft(starter ? { ...newDraft, slug, title: starter.title, body: starter.body } : { ...newDraft, kind });
    setDirty(Boolean(starter));
    setError("");
    setNotice("");
  }

  async function open(slug: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { entry } = await requestContent<{ entry: EntrySummary & { draft: { title: string; summary: string; body: string } } }>(
        url + "&slug=" + encodeURIComponent(slug)
      );
      setCustomSlug(true);
      setDraft({ slug: entry.slug, kind: entry.kind, revision: entry.revision, ...entry.draft });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open the draft.");
    } finally {
      setBusy(false);
    }
  }

  async function update(action: "save" | "publish" | "unpublish") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { revision } = await requestContent<{ revision: number }>("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, market, action }),
      });
      setDraft((current) => ({ ...current, revision }));
      setDirty(false);
      setNotice(action === "save" ? "Draft saved." : action === "publish" ? "Published to the storefront." : "Publication withdrawn.");
      const result = await requestContent<{ content: EntrySummary[] }>(url);
      setEntries(result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update content.");
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void update("save");
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-[#edf4ee] p-4 text-sm text-[#215241]">{notice}</p>}
      {!entries && !error && <p role="status" className="text-sm text-[#52635b]">Loading content…</p>}
      {entries && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
          <section aria-labelledby="content-list" className="min-w-0 rounded-xl border border-[#dfe6e1] bg-white p-4">
            <h2 id="content-list" className="font-semibold">Pages and articles</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={adminPrimaryAction} disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) start("article"); }}>New article</button>
              <button type="button" className={adminAction} disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) start("page"); }}>New page</button>
            </div>
            <Link href={contentUrl(market)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[#215241] underline">
              View Blog &amp; guides
            </Link>
            {(["article", "page"] as const).map((kind) => {
              const items = entries.filter((entry) => entry.kind === kind);
              if (!items.length) return null;
              return (
                <div key={kind} className="mt-3">
                  <h3 className="text-sm font-semibold">{kind === "article" ? "Articles" : "Pages"}</h3>
                  <ul className="mt-1 divide-y divide-[#e4eae5]">
                    {items.map((entry) => (
                      <li key={entry.slug}>
                        <button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) void open(entry.slug); }} className="block min-h-11 w-full break-words rounded-md py-2 text-left text-sm text-[#215241] hover:underline">
                          <span className="block font-semibold">{entry.title}</span>
                          <span className="text-xs text-[#52635b]">{status(entry)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <h3 className="mt-5 text-sm font-semibold">Starter pages</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(starterPages).filter(([slug]) => !entries.some((entry) => entry.slug === slug)).map(([slug, page]) => (
                <button type="button" key={slug} className={adminAction} disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) start("page", slug); }}>{page.title}</button>
              ))}
            </div>
          </section>

          <section aria-labelledby="content-edit" className="min-w-0 rounded-xl border border-[#dfe6e1] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="content-edit" className="font-semibold">{draft.revision ? "Edit draft" : draft.kind === "article" ? "Article draft" : "Page draft"}</h2>
              <button type="button" onClick={() => setPreview((current) => !current)} aria-expanded={preview} className={adminAction}>{preview ? "Hide preview" : "Preview draft"}</button>
            </div>
            <form onSubmit={save} className="mt-4 space-y-4">
              <fieldset disabled={busy} className="min-w-0 space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label htmlFor="content-type">Type</label>
                    <select id="content-type" aria-describedby="content-type-help" className={field} disabled={draft.revision > 0} value={draft.kind} onChange={(event) => change({ kind: event.target.value as ContentKind })}>
                      <option value="page">Page</option>
                      <option value="article">Article</option>
                    </select>
                    <p id="content-type-help" className="mt-1 text-xs text-[#52635b]">
                      {draft.kind === "article" ? "Published articles appear in Blog & guides." : "Published pages have their own storefront link."}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="content-slug">URL slug</label>
                    <input
                      id="content-slug" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      aria-describedby="content-slug-help" placeholder="test-blog-post"
                      className={field} readOnly={draft.revision > 0} value={draft.slug}
                      onChange={(event) => { setCustomSlug(true); change({ slug: event.target.value }); }}
                    />
                    <p id="content-slug-help" className="mt-1 text-xs text-[#52635b]">
                      {draft.revision ? "The slug is fixed after the first save." : "Use lowercase letters, numbers and hyphens. Example: test-blog-post."}
                    </p>
                    {/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug) && (
                      <p className="mt-1 break-all text-xs text-[#52635b]">Storefront link <code>{contentUrl(market, draft.slug)}</code></p>
                    )}
                    {!draft.revision && customSlug && (
                      <button type="button" className="mt-1 min-h-8 text-xs font-semibold text-[#215241] underline" onClick={() => {
                        setCustomSlug(false);
                        change({ slug: slugFromTitle(draft.title) });
                      }}>Use title for slug</button>
                    )}
                  </div>
                </div>
                <label className="block">Title
                  <input required maxLength={120} className={field} value={draft.title} onChange={(event) => changeTitle(event.target.value)} />
                </label>
                <label className="block">Summary (optional)
                  <textarea rows={2} maxLength={300} className={field} value={draft.summary} onChange={(event) => change({ summary: event.target.value })} />
                </label>
                <label className="block">Body
                  <textarea required rows={10} maxLength={16000} className={field} value={draft.body} onChange={(event) => change({ body: event.target.value })} />
                </label>
              </fieldset>
              {preview && (
                <section aria-label="Draft preview" className="space-y-2 rounded-xl bg-[#f5f8f5] p-4 break-words">
                  <h3 className="text-xl font-semibold">{draft.title || "Untitled draft"}</h3>
                  {draft.summary && <p className="text-sm text-[#52635b]">{draft.summary}</p>}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</p>
                </section>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy || !dirty} className={adminPrimaryAction}>Save draft</button>
                <button type="button" disabled={busy || dirty || !draft.revision || Boolean(selected?.published_at && !selected.draft_changed)} className={adminAction} onClick={() => void update("publish")}>Publish saved draft</button>
                {selected?.published_at && (
                  <>
                    <Link href={contentUrl(market, selected.slug)} className={adminAction} target="_blank" rel="noopener noreferrer">View published page</Link>
                    <button type="button" className={adminAction} disabled={busy || dirty} onClick={() => { if (window.confirm("Withdraw this publication from the storefront?")) void update("unpublish"); }}>Unpublish</button>
                  </>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default function AdminContentPage() {
  const [market, setMarket] = useState<ContentMarket>("GB");
  const [dirty, setDirty] = useState(false);

  function selectMarket(next: ContentMarket) {
    if (dirty && !window.confirm("Discard unsaved changes and switch markets?")) return;
    setDirty(false);
    setMarket(next);
  }
  return (
    <main className="min-h-dvh bg-[#f5f7f3]">
      <AdminPageHeading section="Store" title="Content publishing" description="Write and publish storefront pages and buying guides by market." />
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 sm:px-7">
        <label className="block w-full max-w-xs text-sm font-semibold">Market
          <select className={field} value={market} onChange={(event) => selectMarket(event.target.value as ContentMarket)}>
            <option value="GB">United Kingdom</option>
            <option value="NG">Nigeria</option>
          </select>
        </label>
        <ContentEditor key={market} market={market} dirty={dirty} setDirty={setDirty} />
      </div>
    </main>
  );
}
