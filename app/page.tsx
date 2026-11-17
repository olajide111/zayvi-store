import Storefront from "@/components/Storefront";
import { callZayviAwsApi } from "@/lib/aws-api";
import { parseSocialLinks, type SocialLinks } from "@/lib/social-links";
import { resolveStorefrontMarket } from "@/lib/storefront-market-server";

export default async function Home({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market: requestedMarket } = await searchParams;
  const [{ market, settings }, socialLinks] = await Promise.all([
    resolveStorefrontMarket(requestedMarket),
    loadSocialLinks(),
  ]);
  return <Storefront key={market} marketCode={market} marketSettings={settings} socialLinks={socialLinks} />;
}

async function loadSocialLinks(): Promise<SocialLinks> {
  const result = await callZayviAwsApi("/storefront-social-links");
  if (!result.ok) return {};

  try {
    return parseSocialLinks((result.data as { links?: unknown } | null)?.links);
  } catch {
    return {};
  }
}
