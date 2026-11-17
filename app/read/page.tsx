import Link from "next/link";
import { callZayviAwsApi } from "@/lib/aws-api";
import { contentUrl, type ContentKind } from "@/lib/storefront-content";

export const metadata = { title: "Blog & guides | Zayvi Store" };

export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const market = (await searchParams).market === "NG" ? "NG" : "GB";
  const result = await callZayviAwsApi(`/published-content?market=${market}`);
  const data = result.data as { content?: { slug: string; kind: ContentKind; title: string; summary: string }[] } | null;
  const articles = result.ok && Array.isArray(data?.content) ? data.content.filter((entry) => entry.kind === "article") : [];
  return (
    <main className="min-h-dvh bg-[#f5f7f3] px-5 py-8 text-[#172a21] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link className="text-sm font-semibold text-[#215241] underline" href={market === "NG" ? "/?market=NG" : "/"}>Back to Zayvi Store</Link>
        <h1 className="mt-7 text-4xl font-semibold tracking-tight">Blog &amp; guides</h1>
        <p className="mt-2 text-sm text-[#52635b]">{market === "NG" ? "Nigeria" : "United Kingdom"}</p>
        {articles.length ? (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {articles.map((entry) => (
              <li key={entry.slug} className="rounded-xl border border-[#dfe6e1] bg-white p-5">
                <Link className="font-semibold text-[#215241] underline" href={contentUrl(market, entry.slug)}>{entry.title}</Link>
                {entry.summary && <p className="mt-2 text-sm text-[#52635b]">{entry.summary}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="mt-6 text-[#52635b]">{result.ok ? "No guides have been published for this market yet." : "Guides are temporarily unavailable."}</p>}
      </div>
    </main>
  );
}
