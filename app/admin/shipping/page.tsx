import Link from "next/link";
import { fulfilmentCarriers, ownDelivery } from "@/lib/fulfilment-carriers";
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
      <AdminPageHeading section="Store" title="Shipping" description="Choose how to hand off orders and record delivery by market.">
        <Link href="/admin/orders" prefetch={false} className={adminAction}>Order fulfilment</Link>
        <Link href="/admin/returns" prefetch={false} className={adminAction}>Returns</Link>
      </AdminPageHeading>
      <section className="mx-auto max-w-[1500px] space-y-6 px-4 py-5 sm:px-7 lg:px-8">
        <section aria-labelledby="shipping-methods">
          <h2 id="shipping-methods" className="mb-3 text-base font-semibold">Manual shipping by market</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { code: "GB", name: "United Kingdom", note: "For a Post Office drop-off, record the carrier shown on your receipt, such as Royal Mail or Parcelforce." },
              { code: "NG", name: "Nigeria", note: "Check that the courier covers your pickup and destination. Use its waybill number as the tracking reference." },
            ].map(({ code, name, note }) => (
              <div key={code} className="rounded-xl border border-[#dfe6e1] bg-white p-4">
                <h3 className="text-sm font-semibold">{name}</h3>
                <p className="mt-2 text-sm text-[#52635b]">{note}</p>
                <ul aria-label={name + " delivery options"} className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#215241]">
                  {[...fulfilmentCarriers[code], ownDelivery, "Other carrier"].map((carrier) => (
                    <li key={carrier} className="rounded-md bg-[#edf4ee] px-2 py-1">{carrier}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="manual-fulfilment">
          <h2 id="manual-fulfilment" className="mb-3 text-base font-semibold">Fulfil an order</h2>
          <ol className="list-decimal space-y-2 rounded-xl border border-[#dfe6e1] bg-white py-4 pr-4 pl-9 text-sm text-[#52635b]">
            <li>Open an eligible paid order, review the recommended stock source and approve the fulfilment plan.</li>
            <li>Pack owned stock and book the courier yourself, or have the supplier confirm dispatch.</li>
            <li>Record the delivery method and tracking number after handoff. For a personal delivery, choose Own delivery and enter a handover reference if you have one.</li>
            <li>Mark delivery complete once confirmed. Carrier booking and tracking updates are handled outside Zayvi.</li>
          </ol>
        </section>
        <section aria-labelledby="shipping-checklist">
          <h2 id="shipping-checklist" className="mb-3 text-base font-semibold">Delivery setup checklist</h2>
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
      </section>
    </main>
  );
}
