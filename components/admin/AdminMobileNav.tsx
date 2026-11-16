"use client";

import { usePathname } from "next/navigation";

const primary = [
  { label: "Home", href: "/admin/dashboard", icon: "⌂" },
  { label: "Orders", href: "/admin/orders", icon: "▤" },
  { label: "Products", href: "/admin/products", icon: "◇" },
  { label: "Inventory", href: "/admin/inventory", icon: "▦" },
  { label: "Payments", href: "/admin/payments", icon: "◉" },
] as const;

const more = [
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Returns", href: "/admin/returns" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Markets", href: "/admin/markets" },
  { label: "Themes", href: "/admin/themes" },
  { label: "Settings", href: "/admin/settings" },
] as const;

export default function AdminMobileNav() {
  const pathname = usePathname();

  if (!pathname || pathname === "/admin") return null;

  const activeFor = (href: string) =>
    pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href + "/"));

  return (
    <>
      <div className="h-20 lg:hidden" aria-hidden="true" />
      <nav
        aria-label="Admin mobile navigation"
        className="fixed inset-x-0 bottom-0 z-[100] border-t border-gray-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
          {primary.map((item) => {
            const active = activeFor(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={
                  "flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold transition " +
                  (active
                    ? "bg-[#e7efe7] text-[#17251e]"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800")
                }
              >
                <span className="mb-1 text-base leading-none">{item.icon}</span>
                <span className="max-w-full truncate">{item.label}</span>
              </a>
            );
          })}

          <details className="group relative">
            <summary className="flex cursor-pointer list-none flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800 [&::-webkit-details-marker]:hidden">
              <span className="mb-1 text-base leading-none">•••</span>
              <span>More</span>
            </summary>
            <div className="absolute bottom-[calc(100%+10px)] right-0 w-44 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
              {more.map((item) => {
                const active = activeFor(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={
                      "block rounded-xl px-3 py-2.5 text-xs font-semibold " +
                      (active
                        ? "bg-[#e7efe7] text-[#17251e]"
                        : "text-gray-600 hover:bg-gray-50")
                    }
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </details>
        </div>
      </nav>
    </>
  );
}
