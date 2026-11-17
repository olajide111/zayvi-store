import Link from "next/link";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";

const checks = [
  { title: "Delivery coverage", detail: "Define shipping zones and coverage independently for the UK and Nigeria." },
  { title: "Delivery pricing", detail: "Check shipping rates against fulfilment costs before advertising them." },
  { title: "Carrier tracking", detail: "Connect tracking updates and verify customer delivery status." },
  { title: "Customer returns policy", detail: "Confirm customer-facing return instructions and the workflow for receiving goods." },
];

export default function AdminShippingPage() {
  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Store" title="Shipping" description="Review delivery setup before opening customer checkout.">
        <Link href="/admin/orders" prefetch={false} className={adminAction}>Order fulfilment</Link>
        <Link href="/admin/returns" prefetch={false} className={adminAction}>Returns</Link>
      </AdminPageHeading>
      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        <h2 className="mb-3 text-base font-semibold">Delivery setup checklist</h2>
        <ul className="divide-y divide-[#e4eae5] rounded-xl border border-[#dfe6e1] bg-white">
          {checks.map(({ title, detail }) => (
            <li key={title} className="flex flex-wrap items-start justify-between gap-2 p-4">
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-[#52635b]">{detail}</p>
              </div>
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Pending setup</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
