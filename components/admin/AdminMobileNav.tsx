"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AdminSignOut from "./AdminSignOut";
import AdminPageSearch from "./AdminPageSearch";
import { adminGroups, adminPrimary, isAdminRouteActive } from "./admin-navigation";
import {useModalDialog} from '@/hooks/useModalDialog';

const tabClass = "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-semibold leading-tight";

export default function AdminMobileNav() {
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const open = menuPath !== null && menuPath === pathname;
  const dialog=useModalDialog(open,()=>setMenuPath(null));
  const moreActive = adminGroups.some(({ items }) =>
    items.some(({ href }) => isAdminRouteActive(pathname, href)),
  );

  useEffect(() => {
    if (!open) return;

    const desktop=window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop=()=>{if(desktop.matches)setMenuPath(null);};
    closeOnDesktop();desktop.addEventListener('change',closeOnDesktop);
    return()=>desktop.removeEventListener('change',closeOnDesktop);
  }, [open]);

  if (!pathname || pathname === "/admin") return null;

  return (
    <>
      <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden="true" />
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setMenuPath(null)}
          className="fixed inset-0 z-[99] bg-[#132720]/35 lg:hidden"
        />
      )}
      <nav
        aria-label="Admin mobile navigation"
        className="fixed inset-x-0 bottom-0 z-[100] border-t border-[#dfe6e1] bg-white px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] text-[#16372e] lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-0.5">
          {adminPrimary.map(({ label, href, icon: Icon }) => {
            const active = isAdminRouteActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuPath(null)}
                className={tabClass + (active ? " bg-[#e6f0e9]" : " text-[#52635b] hover:bg-[#f1f5f2]")}
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
          <button
            ref={moreButton}
            type="button"
            aria-controls="admin-more-menu"
            aria-expanded={open}
            onClick={() => setMenuPath(open ? null : pathname)}
            className={tabClass + (open || moreActive ? " bg-[#e6f0e9]" : " text-[#52635b] hover:bg-[#f1f5f2]")}
          >
            <Ellipsis size={19} aria-hidden="true" />
            <span className="text-[10px] leading-tight font-semibold">More</span>
          </button>
        </div>
        <div
          id="admin-more-menu"
          ref={dialog}
          role="dialog"
          aria-modal={open?true:undefined}
          aria-labelledby="admin-more-title"
          tabIndex={-1}
          hidden={!open}
          className="absolute inset-x-2 bottom-[calc(100%+0.5rem)] mx-auto max-h-[min(68dvh,29rem)] max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-[#dfe6e1] bg-white p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between gap-3 px-2"><h2 id="admin-more-title" className="text-sm font-semibold">More pages</h2><button type="button" aria-label="Close more pages" onClick={()=>setMenuPath(null)} className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-[#f1f5f2]"><X size={18} aria-hidden="true"/></button></div>
          <AdminPageSearch key={`${pathname}:${open}`} onNavigate={() => setMenuPath(null)} />
          {adminGroups.map(({ label, items }) => (
            <div key={label} className="mb-3 last:mb-0">
              <p className="px-2 py-1 text-xs font-semibold text-[#52635b]">{label}</p>
              <div className="grid grid-cols-2 gap-1">
                {items.map(({ href, title, icon: Icon }) => {
                  const active = isAdminRouteActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      prefetch={false}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuPath(null)}
                      className={"flex min-h-11 items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold leading-tight " + (active ? "bg-[#e6f0e9]" : "hover:bg-[#f1f5f2]")}
                    >
                      <Icon size={16} className="shrink-0" aria-hidden="true" />
                      {title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <AdminSignOut className="mt-2 border-t border-[#dfe6e1] text-[#215241]" />
        </div>
      </nav>
    </>
  );
}
