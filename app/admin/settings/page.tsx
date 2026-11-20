import Link from "next/link";
import { ArrowUpRight, CreditCard, FileText, Globe2, Link2, Palette, ShieldCheck, Truck } from "lucide-react";
import StorefrontChecklist from "./StorefrontChecklist";
import SetupOverview from "./SetupOverview";
import AdminPageHeading from "@/components/admin/AdminPageHeading";

const destinations = [
  { href: "/admin/get-started", title: "Design your store", description: "Tell us about your business and explore recommended themes in the full-window studio.", icon: Palette },
  { href: "/admin/markets", title: "Markets & currencies", description: "Choose where your store sells and manage regional pricing.", icon: Globe2 },
  { href: "/admin/content", title: "Content publishing", description: "Set up storefront pages and write articles by market.", icon: FileText },
  { href: "/admin/settings/social-links", title: "Social links", description: "Choose which social profiles appear in your storefront footer.", icon: Link2 },
  { href: "/admin/themes", title: "Themes & layouts", description: "Preview storefront templates and colours.", icon: Palette },
  { href: "/admin/payments", title: "Payments", description: "Manage connections and test payments.", icon: CreditCard },
  { href: "/admin/shipping", title: "Shipping", description: "Review delivery and fulfilment setup.", icon: Truck },
  { href: "/admin/system-readiness", title: "System readiness", description: "Check the deployed Preview schema.", icon: ShieldCheck },
];

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const market = (await searchParams).market === "NG" ? "NG" : "GB";
  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Store" title="Store setup" description="Set up customer pages and review your store’s markets, delivery and payments." />
      <SetupOverview />
      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-7 lg:px-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <StorefrontChecklist market={market} />
        <section aria-labelledby="setup-destinations" className="grid content-start gap-3">
          <h2 id="setup-destinations" className="text-lg font-semibold tracking-tight">Store settings</h2>
          {destinations.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href === "/admin/content" ? `${href}?market=${market}` : href} prefetch={false} className="flex items-start gap-3 rounded-xl border border-[#dfe6e1] bg-white p-4 hover:border-[#96ae9c] hover:bg-[#f5f8f5]">
              <Icon size={19} className="mt-0.5 shrink-0 text-[#215241]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-[#52635b]">{description}</p>
              </div>
              <ArrowUpRight size={16} className="mt-1 shrink-0 text-[#215241]" aria-hidden="true" />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
