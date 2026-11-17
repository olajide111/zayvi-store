"use client";

import Link from "next/link";
import { marketPath } from "@/lib/storefront-market";
import { useRef } from "react";
import { ChevronDown, Search, ShoppingBag } from "lucide-react";
import { contentUrl, type ContentMarket } from "@/lib/storefront-content";

const categories = ["Travel", "Carry", "Recovery", "Daily"];

type Props = {
  market: ContentMarket;
  cartCount: number;
  onCartOpen: () => void;
  onSearch: () => void;
  onShopAll: () => void;
  onBestSellers: () => void;
  onCategory: (category: string) => void;
  scrolled: boolean;
};

export default function Header({ market, cartCount, onCartOpen, onSearch, onShopAll, onBestSellers, onCategory, scrolled }: Props) {
  const shop = useRef<HTMLDetailsElement>(null);

  function select(action: () => void) {
    if (shop.current) {
      shop.current.open = false;
      shop.current.querySelector("summary")?.focus({ preventScroll: true });
    }
    action();
  }

  const item = "block min-h-11 w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-[#edf4ee]";

  return (
    <nav aria-label="Storefront" className={`sticky top-0 z-[900] border-b border-[#e4eae5] bg-white text-[#172a21]${scrolled ? " shadow-sm" : ""}`}>
      <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between gap-2 px-3 sm:gap-5 sm:px-6">
        <Link href={marketPath("/", market)} className="shrink-0 text-xl font-black tracking-tight">
          ZAYVI<span className="text-[#215241]">.</span>
        </Link>

        <div className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
          <details ref={shop} className="relative"
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && event.currentTarget.open) {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-2 hover:bg-[#edf4ee] [&::-webkit-details-marker]:hidden">
              Shop <ChevronDown size={13} aria-hidden="true" />
            </summary>
            <ul className="absolute top-full left-1/2 z-10 mt-1 w-40 -translate-x-1/2 rounded-xl border border-[#dfe6e1] bg-white p-1.5 shadow-lg">
              <li><button type="button" className={item} onClick={() => select(onShopAll)}>All products</button></li>
              <li><button type="button" className={item} onClick={() => select(onBestSellers)}>Best sellers</button></li>
              {categories.map((category) => (
                <li key={category}><button type="button" className={item} onClick={() => select(() => onCategory(category))}>{category}</button></li>
              ))}
            </ul>
          </details>
          <button type="button" onClick={onBestSellers} className="hidden min-h-11 items-center rounded-md px-2 hover:bg-[#edf4ee] sm:inline-flex">Best sellers</button>
          <Link href={contentUrl(market)} className="inline-flex min-h-11 items-center rounded-md px-2 hover:bg-[#edf4ee]">Guides</Link>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={onSearch} aria-label="Search products" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-[#edf4ee]">
            <Search size={19} aria-hidden="true" />
          </button>
          <button type="button" onClick={onCartOpen} aria-label={cartCount ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart"} className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f5f7f3] hover:bg-[#edf4ee]">
            <ShoppingBag size={19} aria-hidden="true" />
            {cartCount > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-5 rounded-full bg-[#215241] px-1 text-xs leading-5 font-semibold text-white">{cartCount}</span>}
          </button>
        </div>
      </div>
    </nav>
  );
}
