import ReadingNav from "@/components/ReadingNav";
import ReadingFooter from "@/components/ReadingFooter";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveStorefrontMarket } from "@/lib/storefront-market-server";
import { callZayviAwsApi } from "@/lib/aws-api";
import { contentUrl, starterPages, type ContentCopy } from "@/lib/storefront-content";
import { marketPath } from "@/lib/storefront-market";

export default async function PublishedPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { slug } = await params;
  const { market, settings, unavailable } = await resolveStorefrontMarket((await searchParams).market);
  if (unavailable) notFound();
  if (slug.length > 80 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  const result = await callZayviAwsApi(`/published-content?market=${market}&slug=${encodeURIComponent(slug)}`);
  const published = result.ok ? (result.data as { entry?: ContentCopy })?.entry : undefined;
  const entry = published ?? (Object.hasOwn(starterPages, slug) ? starterPages[slug] : undefined);
  if (!entry) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-[#f5f7f3] text-[#172a21]">
      <ReadingNav market={market} settings={settings} />
      <main className="mx-auto w-full max-w-3xl px-5 pt-6 pb-12 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-[#52635b]">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li><Link href={marketPath("/", market)} className="inline-flex min-h-11 items-center hover:underline">Store</Link></li>
            <li aria-hidden="true">/</li>
            <li className="min-w-0 break-words" aria-current="page">{entry.title}</li>
          </ol>
        </nav>
        <article>
        <h1 className="mt-5 font-serif text-4xl tracking-tight break-words sm:text-5xl">{entry.title}</h1>
        {entry.summary && <p className="mt-3 text-lg break-words text-[#52635b]">{entry.summary}</p>}
        <div className="mt-6 rounded-xl border border-[#dfe6e1] bg-white p-5 text-base leading-relaxed whitespace-pre-wrap break-words sm:p-7">{entry.body}</div>
        </article>
        <Link href={contentUrl(market)} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[#215241] underline">Explore blog &amp; guides</Link>
      </main>
      <ReadingFooter market={market} />
    </div>
  );
}
