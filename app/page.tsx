import Storefront from "@/components/Storefront";
import { resolveStorefrontMarket } from "@/lib/storefront-market-server";

export default async function Home({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market, settings } = await resolveStorefrontMarket((await searchParams).market);
  return <Storefront key={market} marketCode={market} marketSettings={settings} />;
}
