import Storefront from "@/components/Storefront";

export default async function Home({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market } = await searchParams;
  const marketCode = typeof market === "string" && market.toUpperCase() === "NG" ? "NG" : "GB";

  return <Storefront key={marketCode} marketCode={marketCode} />;
}
