import ProductDetails from "./product-detail";
import { notFound } from "next/navigation";
import { resolveStorefrontMarket } from "@/lib/storefront-market-server";

export default async function ProductPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { id } = await params;
  const { market, unavailable } = await resolveStorefrontMarket((await searchParams).market);
  if (unavailable) notFound();

  return <ProductDetails key={`${market}:${id}`} id={id} market={market} />;
}
