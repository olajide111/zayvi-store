export default function AdminShippingPage() {
  const checks = [
    ["Shipping zones", "Pending", "Define UK-first delivery coverage and future Nigeria rules."],
    ["Delivery pricing", "Pending", "Keep free-shipping messaging disabled until cost rules are verified."],
    ["Returns policy", "Pending", "Configure the operational 30-day return workflow before checkout."],
    ["Tracking", "Pending", "Connect carrier/tracking data when fulfilment goes live."],
  ];

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div><div className="text-xs text-gray-400">Workspace / Growth</div><h1 className="mt-1 text-xl font-semibold text-[#17251e]">Shipping & Returns</h1></div>
          <a href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">Back to overview</a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5">
          <div className="text-sm font-semibold text-[#23432d]">Fulfilment configuration</div>
          <p className="mt-1 text-xs leading-5 text-[#55705b]">These controls are intentionally held in Preview until the storefront and order model are connected.</p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {checks.map(([title,status,note], index) => (
            <div key={title} className={`flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between ${index ? "border-t border-gray-100" : ""}`}>
              <div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs text-gray-500">{note}</div></div>
              <span className="self-start rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 md:self-auto">{status}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
