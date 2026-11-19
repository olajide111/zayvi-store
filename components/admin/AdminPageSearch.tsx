"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useId, useState } from "react";
import { adminGroups, adminPrimary } from "./admin-navigation";

const destinations = [
  ...adminPrimary.map((item) => ({ ...item, group: "Workspace" })),
  ...adminGroups.flatMap(({ label, items }) => items.map((item) => ({ ...item, group: label }))),
];

const keywords: Record<string, string> = {
  "/admin/settings/social-links": "facebook instagram tiktok youtube social profiles footer",
  "/admin/content": "blog articles guides pages privacy terms contact about",
  "/admin/markets": "country countries nigeria uk currencies where sell",
  "/admin/settings": "start onboarding configuration settings",
  "/admin/returns": "refund returns requests",
  "/admin/payments": "kredal paypal square verify refund webhook",
  "/admin/themes": "design appearance colours layout",
};

export default function AdminPageSearch({ dark = false, onNavigate }: { dark?: boolean; onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = terms.length ? destinations.filter(({ href, title, group }) => {
    const text = `${title} ${group} ${keywords[href] || ""}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  }) : [];

  return (
    <div className={dark ? "mx-3 mb-3 text-[#dfebe3]" : "mb-3 text-[#172a21]"}>
      <label htmlFor={id} className="sr-only">Find an admin page</label>
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3" />
        <input id={id} type="search" value={query} placeholder="Find a page…" autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape" && query) { event.stopPropagation(); setQuery(""); } }}
          className={`min-h-11 w-full rounded-lg border py-2 pr-3 pl-9 text-sm outline-offset-2 ${dark ? "border-white/20 bg-white/5 placeholder:text-[#b0c6b8]" : "border-[#dfe6e1] bg-[#f5f8f5] placeholder:text-[#52635b]"}`} />
      </div>
      {terms.length > 0 && (
        <div className="mt-2">
          <p role="status" className="px-1 text-xs">{matches.length ? `${matches.length} ${matches.length === 1 ? "page" : "pages"} found` : "No pages found. Try orders, social or shipping."}</p>
          <ul aria-label="Matching admin pages" className="mt-1 max-h-56 space-y-1 overflow-y-auto overscroll-contain">
            {matches.map(({ title, href, group, icon: Icon }) => (
              <li key={href}>
                <Link href={href} prefetch={false} onClick={() => { setQuery(""); onNavigate?.(); }}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm ${dark ? "hover:bg-white/10" : "hover:bg-[#e6f0e9]"}`}>
                  <Icon size={16} aria-hidden="true" className="shrink-0" />
                  <span><span className="block font-semibold">{title}</span><span className="block text-xs opacity-75">{group}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
