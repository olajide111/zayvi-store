export default function AdminPaymentsPage() {
  const providers = [
    { name: "PayPal", status: "Disabled in Preview", note: "Existing integration retained; order creation is server-side blocked." },
    { name: "Square", status: "Disabled in Preview", note: "Existing integration retained; charges are server-side blocked." },
    { name: "Stripe", status: "Not configured", note: "Optional future provider." },
  ];

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div><div className="text-xs text-gray-400">Workspace / Finance</div><h1 className="mt-1 text-xl font-semibold text-[#17251e]">Payments</h1></div>
          <a href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">Back to overview</a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-800">Payment processing remains disabled</div>
          <p className="mt-1 text-xs leading-5 text-amber-700">We will re-enable payments only after the database-driven storefront, order persistence, fulfilment and final checkout verification are complete.</p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {providers.map((provider) => (
            <div key={provider.name} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{provider.name}</h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">{provider.status}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-500">{provider.note}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
