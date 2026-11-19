import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { contentUrl, type ContentMarket } from "@/lib/storefront-content";
import { marketPath } from "@/lib/storefront-market";

export default function ReadingFooter({ market }: { market: ContentMarket }) {
  return (
    <footer className="mt-auto border-t border-[#dfe6e1] bg-white">
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-9 sm:grid-cols-[1.2fr_1fr] sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#52635b]">Back to the store</p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight">Find your next everyday essential.</h2>
          <Link href={marketPath("/", market)} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#215241] underline">Browse the collection<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <nav aria-label="Reading help" className="grid grid-cols-2 content-start gap-x-4 gap-y-1 text-sm text-[#52635b]">
          {[
            ["Contact us", "contact"], ["Shipping information", "shipping"],
            ["Returns and cancellations", "returns"], ["FAQs", "faqs"],
            ["Privacy notice", "privacy"], ["Terms of sale", "terms"],
          ].map(([label, slug]) => <Link key={slug} href={contentUrl(market, slug)} className="flex min-h-11 items-center py-2 hover:text-[#215241] hover:underline">{label}</Link>)}
        </nav>
      </div>
    </footer>
  );
}
