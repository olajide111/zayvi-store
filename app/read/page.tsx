import { notFound } from "next/navigation";
import ReadingNav from "@/components/ReadingNav";
import ReadingFooter from "@/components/ReadingFooter";
import GuidesLibrary from "@/components/GuidesLibrary";
import { resolveStorefrontMarket } from "@/lib/storefront-market-server";
import { callZayviAwsApi } from "@/lib/aws-api";
import { type ContentKind } from "@/lib/storefront-content";

export const metadata = { title: "Blog & guides | Zayvi Store" };

export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market, settings, unavailable } = await resolveStorefrontMarket((await searchParams).market);
  if (unavailable) notFound();
  const result = await callZayviAwsApi(`/published-content?market=${market}`);
  const data = result.data as { content?: { slug: string; kind: ContentKind; title: string; summary: string }[] } | null;
  const articles = result.ok && Array.isArray(data?.content) ? data.content.filter((entry) => entry.kind === "article") : [];
  return (
    <div className="flex min-h-dvh flex-col bg-[#f5f7f3] text-[#172a21]">
      <ReadingNav market={market} settings={settings} index />
      <main className="mx-auto w-full max-w-5xl px-5 pt-10 pb-12 sm:px-8 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#52635b]">The Zayvi journal · {market === "NG" ? "Nigeria" : "United Kingdom"}</p>
        <h1 className="mt-4 font-serif text-5xl tracking-tight sm:text-6xl">Blog &amp; guides</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[#52635b]">Ideas and practical guides for everyday choices.</p>
        {result.ok ? <GuidesLibrary articles={articles} market={market} /> : <p role="status" className="mt-8 rounded-2xl border border-[#dfe6e1] bg-white p-6 text-[#52635b]">Guides are temporarily unavailable. Please try again later, or use the help links below.</p>}
      </main>
      <ReadingFooter market={market} />
    </div>
  );
}
