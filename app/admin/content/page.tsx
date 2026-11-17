import ContentPublishingEditor from "./editor";
import { setupPageSlugs } from "@/lib/admin-content";

export default async function AdminContentPage({ searchParams }: {
  searchParams: Promise<{ market?: string; page?: string }>;
}) {
  const { market, page } = await searchParams;
  const initialMarket = market === "NG" ? "NG" : "GB";
  const initialPage = setupPageSlugs.find((slug) => slug === page);
  return <ContentPublishingEditor key={`${initialMarket}:${initialPage ?? ""}`} initialMarket={initialMarket} initialPage={initialPage} />;
}
