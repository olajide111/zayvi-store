import ReadingNav from "@/components/ReadingNav";
import { notFound } from "next/navigation";
import { callZayviAwsApi } from "@/lib/aws-api";
import { starterPages, type ContentCopy } from "@/lib/storefront-content";

export default async function PublishedPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ market?: string }>;
}) {
  const { slug } = await params;
  const market = (await searchParams).market === "NG" ? "NG" : "GB";
  if (slug.length > 80 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  const result = await callZayviAwsApi(`/published-content?market=${market}&slug=${encodeURIComponent(slug)}`);
  const published = result.ok ? (result.data as { entry?: ContentCopy })?.entry : undefined;
  const entry = published ?? (Object.hasOwn(starterPages, slug) ? starterPages[slug] : undefined);
  if (!entry) notFound();

  return (
    <div className="min-h-dvh bg-[#f5f7f3] text-[#172a21]">
      <ReadingNav market={market} />
      <main className="mx-auto max-w-3xl px-5 py-5 sm:px-8">
        <article>
        <h1 className="mt-7 text-3xl font-semibold tracking-tight break-words sm:text-5xl">{entry.title}</h1>
        {entry.summary && <p className="mt-3 text-lg break-words text-[#52635b]">{entry.summary}</p>}
        <div className="mt-6 rounded-xl border border-[#dfe6e1] bg-white p-5 text-base leading-relaxed whitespace-pre-wrap break-words sm:p-7">{entry.body}</div>
        </article>
      </main>
    </div>
  );
}
