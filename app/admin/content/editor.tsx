"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import ContentLibrary, { publicationStatus } from "./ContentLibrary";
import { requestContent, type EntrySummary } from "@/lib/admin-content";
import AdminPageHeading, { adminAction, adminPrimaryAction } from "@/components/admin/AdminPageHeading";
import { contentUrl, starterPages, type ContentKind, type ContentMarket } from "@/lib/storefront-content";

type Draft = { slug: string; kind: ContentKind; title: string; summary: string; body: string; revision: number };
const newDraft: Draft = { slug: "", kind: "page", title: "", summary: "", body: "", revision: 0 };
const field = "mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-[#9eafa3] bg-white px-3 py-2 text-base";

function slugFromTitle(title: string) {
  return title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 80).replace(/-+$/, "");
}

type Confirmation = { title: string; detail: string; label: string; run: () => void };

function ConfirmDialog({ confirmation, close }: { confirmation: Confirmation | null; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (confirmation && element && !element.open) {
      element.showModal();
      keepEditing.current?.focus();
    } else if (!confirmation && element?.open) {
      element.close();
    }
  }, [confirmation]);

  return (
    <dialog ref={dialog} aria-labelledby="content-confirm-title" aria-describedby="content-confirm-detail"
      onCancel={(event) => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-[27rem] rounded-2xl border border-[#dfe6e1] bg-white p-5 text-[#172a21] shadow-2xl backdrop:bg-[#142e26]/45 sm:p-6">
      {confirmation && (
        <>
          <h2 id="content-confirm-title" className="text-lg font-semibold tracking-tight">{confirmation.title}</h2>
          <p id="content-confirm-detail" className="mt-2 text-sm leading-relaxed text-[#52635b]">{confirmation.detail}</p>
          <div className="mt-5 flex flex-wrap gap-2 sm:justify-end">
            <button ref={keepEditing} type="button" className={adminAction} onClick={close}>Keep editing</button>
            <button type="button" className="inline-flex min-h-11 items-center rounded-lg bg-red-800 px-3.5 text-sm font-semibold text-white hover:bg-red-900" onClick={() => { close(); confirmation.run(); }}>{confirmation.label}</button>
          </div>
        </>
      )}
    </dialog>
  );
}

function starterDraft(slug: string): Draft {
  const page = starterPages[slug];
  return { ...newDraft, slug, title: page.title, body: page.body };
}

function ContentEditor({ market, initialPage, dirty, setDirty, busy, setBusy, guard, confirm }: {
  market: ContentMarket;
  initialPage?: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  guard: (action: () => void) => void;
  confirm: (confirmation: Confirmation) => void;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}) {
  const [entries, setEntries] = useState<EntrySummary[] | null>(null);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [customSlug, setCustomSlug] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const libraryHeading = useRef<HTMLHeadingElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const url = `/api/admin/content?market=${market}`;
  const selected = entries?.find((entry) => entry.slug === draft.slug);
  const canSave = (dirty || draft.revision === 0) && Boolean(draft.title.trim() && draft.body.trim() && draft.slug);

  useEffect(() => {
    const abort = new AbortController();
    requestContent<{ content: EntrySummary[] }>(url, { signal: abort.signal })
      .then(async (result) => {
        if (initialPage && !abort.signal.aborted) {
          const existing = result.content.find((entry) => entry.slug === initialPage);
          if (existing) {
            const { entry } = await requestContent<{ entry: EntrySummary & { draft: Pick<Draft, "title" | "summary" | "body"> } }>(
              url + "&slug=" + encodeURIComponent(initialPage), { signal: abort.signal },
            );
            if (!abort.signal.aborted) setDraft({ slug: entry.slug, kind: entry.kind, revision: entry.revision, ...entry.draft });
          } else {
            setDraft(starterDraft(initialPage));
          }
          if (!abort.signal.aborted) setCustomSlug(true);
        }
        if (!abort.signal.aborted) setEntries(result.content);
      })
      .catch((err: Error) => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [initialPage, url]);

  function change(update: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...update }));
    setDirty(true);
    setNotice("");
  }

  function changeTitle(title: string) {
    change(!draft.revision && !customSlug ? { title, slug: slugFromTitle(title) } : { title });
  }

  function focusEditor() {
    requestAnimationFrame(() => editorHeading.current?.focus());
  }

  function start(kind: ContentKind, slug = "") {
    const starter = starterPages[slug];
    setCustomSlug(Boolean(starter));
    setDraft(starter ? starterDraft(slug) : { ...newDraft, kind });
    setDirty(false);
    setPreview(false);
    setError("");
    setNotice("");
    focusEditor();
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
      setPreview(false);
      focusEditor();
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
    if (!busy && canSave) void update("save");
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-[#edf4ee] p-4 text-sm text-[#215241]">{notice}</p>}
      {!entries && !error && <p role="status" className="text-sm text-[#52635b]">Loading content…</p>}
      {entries && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,2fr)]">
          <ContentLibrary entries={entries} market={market} busy={busy} selectedSlug={draft.revision > 0 ? draft.slug : undefined}
            headingRef={libraryHeading}
            onStart={(kind, slug) => guard(() => start(kind, slug))}
            onOpen={(slug) => guard(() => void open(slug))} />

          <section aria-labelledby="content-edit" className={`min-w-0 overflow-hidden rounded-2xl border border-[#dfe6e1] bg-white ${initialPage ? "order-first lg:order-none" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4eae5] bg-[#f9fbf8] p-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="content-edit" ref={editorHeading} tabIndex={-1} className="scroll-mt-4 text-lg font-semibold tracking-tight break-words">{draft.title || (draft.kind === "article" ? "New article" : "New page")}</h2>
                <p className="mt-1 text-xs font-medium text-[#52635b]">{dirty ? "Unsaved changes" : draft.revision && selected ? publicationStatus(selected) : "New draft"}</p>
              </div>
              <button type="button" onClick={() => libraryHeading.current?.focus()} className={adminAction + " lg:hidden"}>Back to library</button>
              <button type="button" onClick={() => setPreview((current) => !current)} aria-expanded={preview} className={adminAction}>{preview ? "Hide preview" : "Preview draft"}</button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <fieldset disabled={busy} className="min-w-0 space-y-4 px-4 pt-4 text-sm sm:px-6">
                <label className="block">Title
                  <input required maxLength={120} className={field} value={draft.title} onChange={(event) => changeTitle(event.target.value)} />
                </label>
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
                <label className="block">Summary (optional)
                  <textarea rows={2} maxLength={300} className={field} value={draft.summary} onChange={(event) => change({ summary: event.target.value })} />
                </label>
                <label className="block">Body
                  <textarea required rows={9} maxLength={16000} className={field + " leading-relaxed"} value={draft.body} onChange={(event) => change({ body: event.target.value })} />
                </label>
              </fieldset>
              {preview && (
                <section aria-label="Draft preview" className="mx-4 space-y-2 rounded-xl bg-[#f5f8f5] p-4 break-words sm:mx-6">
                  <h3 className="text-xl font-semibold">{draft.title || "Untitled draft"}</h3>
                  {draft.summary && <p className="text-sm text-[#52635b]">{draft.summary}</p>}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</p>
                </section>
              )}
              <div className="flex flex-wrap gap-2 border-t border-[#e4eae5] bg-[#f9fbf8] p-4 sm:px-6">
                <button type="submit" disabled={busy || !canSave} className={adminPrimaryAction}>Save draft</button>
                <button type="button" disabled={busy || dirty || !draft.revision || Boolean(selected?.published_at && !selected.draft_changed)} className={adminAction} onClick={() => void update("publish")}>Publish saved draft</button>
                {selected?.published_at && (
                  <>
                    <Link href={contentUrl(market, selected.slug)} className={adminAction} target="_blank" rel="noopener noreferrer">View published page</Link>
                    <button type="button" className={adminAction} disabled={busy || dirty} onClick={() => confirm({ title: "Unpublish this content?", detail: "The publication will be removed from the storefront. Its saved draft will remain in Admin.", label: "Unpublish", run: () => void update("unpublish") })}>Unpublish</button>
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

export default function ContentPublishingEditor({ initialMarket, initialPage }: { initialMarket: ContentMarket; initialPage?: string }) {
  const router = useRouter();
  const [market, setMarket] = useState(initialMarket);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [dirty, setDirty] = useState(false);

  function guard(action: () => void) {
    if (!dirty) { action(); return; }
    setConfirmation({
      title: "Discard unsaved changes?",
      detail: "Save this draft before leaving if you want to keep your edits.",
      label: "Discard changes",
      run: action,
    });
  }

  function selectMarket(next: ContentMarket) {
    if (next === market) return;
    guard(() => {
      setDirty(false);
      setMarket(next);
    });
  }
  return (
    <main className="min-h-dvh bg-[#f5f7f3]">
      <AdminPageHeading section="Store" title="Content publishing" description="Write and publish storefront pages and buying guides by market.">
        <Link href={`/admin/settings?market=${market}`} className={adminAction}
          onNavigate={(event) => {
            if (busy || dirty) event.preventDefault();
            if (!busy && dirty) guard(() => router.push(`/admin/settings?market=${market}`));
          }}>Store setup <ArrowUpRight size={15} className="ml-1" aria-hidden="true" /></Link>
      </AdminPageHeading>
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 sm:px-7">
        <label className="block w-full max-w-xs text-sm font-semibold">Market
          <select className={field} disabled={busy} value={market} onChange={(event) => selectMarket(event.target.value as ContentMarket)}>
            <option value="GB">United Kingdom</option>
            <option value="NG">Nigeria</option>
          </select>
        </label>
        <ContentEditor key={market} market={market} initialPage={market === initialMarket ? initialPage : undefined}
          dirty={dirty} setDirty={setDirty} busy={busy} setBusy={setBusy} guard={guard} confirm={setConfirmation} />
      </div>
      <ConfirmDialog confirmation={confirmation} close={() => setConfirmation(null)} />
    </main>
  );
}
