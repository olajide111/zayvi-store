import { notFound } from "next/navigation";
import Link from "next/link";
import ReadingNav from "@/components/ReadingNav";
import { resolveStorefrontMarket } from "@/lib/storefront-market-server";
import { callZayviAwsApi } from "@/lib/aws-api";
import { contentUrl, type ContentKind } from "@/lib/storefront-content";

export const metadata = { title: "Blog & guides | Zayvi Store" };

export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market, settings, unavailable } = await resolveStorefrontMarket((await searchParams).market);
  if (unavailable) notFound();
  const result = await callZayviAwsApi(`/published-content?market=${market}`);
  const data = result.data as { content?: { slug: string; kind: ContentKind; title: string; summary: string }[] } | null;
  const articles = result.ok && Array.isArray(data?.content) ? data.content.filter((entry) => entry.kind === "article") : [];
  return (
    <div className="min-h-dvh bg-[#f5f7f3] text-[#172a21]">
      <ReadingNav market={market} settings={settings} index />
      <main className="mx-auto max-w-4xl px-5 py-5 sm:px-8">
        <h1 className="mt-7 text-4xl font-semibold tracking-tight">Blog &amp; guides</h1>
        <p className="mt-2 text-sm text-[#52635b]">{market === "NG" ? "Nigeria" : "United Kingdom"}</p>
        {articles.length ? (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {articles.map((entry) => (
              <li key={entry.slug}>
                <Link className="group block h-full rounded-xl border border-[#dfe6e1] bg-white p-5 hover:border-[#9eafa3]" href={contentUrl(market, entry.slug)}>
                  <h2 className="break-words font-semibold text-[#215241] group-hover:underline">{entry.title}</h2>
                  {entry.summary && <p className="mt-2 break-words text-sm text-[#52635b]">{entry.summary}</p>}
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-6 text-[#52635b]">{result.ok ? "No guides have been published for this market yet." : "Guides are temporarily unavailable."}</p>}
      </main>
    </div>
  );
}
