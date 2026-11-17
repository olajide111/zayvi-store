import ProductDetails from "./product-detail";
import { storefrontMarket } from "@/lib/storefront-market";

export default async function ProductPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { id } = await params;
  const market = storefrontMarket((await searchParams).market);

  return <ProductDetails key={`${market}:${id}`} id={id} market={market} />;
}
