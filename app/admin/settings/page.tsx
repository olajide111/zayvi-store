import Link from "next/link";
import { ArrowUpRight, CreditCard, Globe2, Palette, ShieldCheck, Truck } from "lucide-react";
import AdminPageHeading from "@/components/admin/AdminPageHeading";

const destinations = [
  { href: "/admin/markets", title: "Markets & currencies", description: "Review regional pricing and publication.", icon: Globe2 },
  { href: "/admin/themes", title: "Themes & layouts", description: "Preview storefront templates and colours.", icon: Palette },
  { href: "/admin/payments", title: "Payments", description: "Manage connections and test payments.", icon: CreditCard },
  { href: "/admin/shipping", title: "Shipping", description: "Review delivery and fulfilment setup.", icon: Truck },
  { href: "/admin/system-readiness", title: "System readiness", description: "Check the deployed Preview schema.", icon: ShieldCheck },
];

export default function AdminSettingsPage() {
  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Store" title="Settings" description="Open the workspaces that manage your store and Preview setup." />
      <section className="mx-auto grid max-w-[1500px] gap-3 px-4 py-5 sm:grid-cols-2 sm:px-7 lg:px-8 xl:grid-cols-3">
        {destinations.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} prefetch={false} className="flex items-start gap-3 rounded-xl border border-[#dfe6e1] bg-white p-4 hover:border-[#96ae9c] hover:bg-[#f5f8f5]">
            <Icon size={19} className="mt-0.5 shrink-0 text-[#215241]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-[#52635b]">{description}</p>
            </div>
            <ArrowUpRight size={16} className="mt-1 shrink-0 text-[#215241]" aria-hidden="true" />
          </Link>
        ))}
      </section>
    </main>
  );
}
