"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ExternalLink, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import AdminMobileNav from "./AdminMobileNav";
import AdminSignOut from "./AdminSignOut";
import AdminPageSearch from "./AdminPageSearch";
import { adminGroups, adminPrimary, isAdminRouteActive } from "./admin-navigation";

type Destination = { title: string; href: string; icon: LucideIcon };

function WorkspaceLink({ item, pathname }: { item: Destination; pathname: string }) {
  const { href, title, icon: Icon } = item;
  const active = isAdminRouteActive(pathname, href);

  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={"flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] leading-tight " +
        (active ? "bg-[#e1eedc] font-semibold text-[#173a2e]" : "text-[#dfebe3] hover:bg-white/10")}
    >
      <Icon size={16} className="shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {title}
    </Link>
  );
}

export default function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!pathname || pathname === "/admin" || pathname.startsWith("/admin/themes/") || pathname.startsWith("/admin/pilots/default/demo") || pathname.startsWith("/admin/pilots/default/preview") || pathname.startsWith("/admin/pilots/hammy/demo") || pathname.startsWith("/admin/pilots/hammy/preview") || pathname === "/admin/get-started") return children;

  const activeGroup = adminGroups.find(({ items }) =>
    items.some(({ href }) => isAdminRouteActive(pathname, href)),
  )?.label;

  return (
    <div className="min-h-screen bg-[#f7f8f6] font-sans text-[#172a21]">
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[110] focus:rounded-lg focus:bg-white focus:p-3">
        Skip to workspace content
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-52 flex-col bg-[#142e26] text-white lg:flex xl:w-56">
        <Link href="/admin/dashboard" prefetch={false} className="mx-3 mt-3 mb-2 flex shrink-0 items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 place-items-center rounded-xl bg-[#dce9d4] text-lg font-bold text-[#173a2e]" aria-hidden="true">Z</span>
          <span>
            <span className="block text-sm font-semibold">Zayvi Store</span>
            <span className="block text-xs text-[#b0c6b8]">Admin workspace</span>
          </span>
        </Link>
        <AdminPageSearch key={pathname} dark />
        <nav aria-label="Admin sidebar" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-0.5 px-3 pb-3">
            {adminPrimary.map((item) => <WorkspaceLink key={item.href} item={item} pathname={pathname} />)}
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain border-t border-white/15 px-3 py-2">
            {adminGroups.map(({ label, items }) => (
              <details key={label + ":" + (activeGroup === label)} open={activeGroup ? activeGroup === label : label === "Operations"} className="group">
                <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between rounded-md px-2.5 text-xs font-semibold text-[#b0c6b8] hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                  {label}
                  <ChevronDown size={15} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-0.5 pb-1">
                  {items.map((item) => <WorkspaceLink key={item.href} item={item} pathname={pathname} />)}
                </div>
              </details>
            ))}
          </div>
        </nav>
        <Link href="/" target="_blank" rel="noopener noreferrer" className="flex min-h-11 shrink-0 items-center gap-2.5 border-t border-white/15 px-5 text-sm text-[#dfebe3] hover:bg-white/10">
          <ExternalLink size={15} aria-hidden="true" /> View storefront
        </Link>
        <AdminSignOut className="shrink-0 border-t border-white/15 px-3 text-[#dfebe3] hover:bg-white/10" />
      </aside>
      <div id="admin-content" tabIndex={-1} className="min-w-0 lg:ml-52 xl:ml-56">
        {children}
      </div>
      <AdminMobileNav />
    </div>
  );
}
