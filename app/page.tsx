import ThemedShop from '@/components/themes/ThemedShop';
import {previewThemeStorefrontEnabled,resolveReleasedTheme} from '@/lib/released-theme';
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
  if(previewThemeStorefrontEnabled(process.env)){
    const response=await callZayviAwsApi('/theme-release');
    const release=response.ok?resolveReleasedTheme(response.data):null;
    if(!release)return <main className="mx-auto max-w-2xl p-8"><h1>Store preview is not ready</h1><p>The released design is unavailable. Please try again later.</p></main>;
    const d=release.config.draft;
    return <ThemedShop key={`${release.releaseId}:${market}`} theme={release.theme} market={market} brand={d.brand} headline={d.headline} motion={d.motion} font={d.font} palette={d.palette} colourInput={d.colours} view="home" source="store"/>;
  }
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
