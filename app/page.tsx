import Storefront from "@/components/Storefront";
import { storefrontMarket } from "@/lib/storefront-market";

export default async function Home({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market } = await searchParams;
  const marketCode = storefrontMarket(market);

  return <Storefront key={marketCode} marketCode={marketCode} />;
}
