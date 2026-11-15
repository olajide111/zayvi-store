export default function AdminPaymentsPage() {
  const providers = [
    {
      name: "Kredal Pay",
      market: "Nigeria · NGN",
      status: "Foundation ready · payments disabled",
      note: "Primary Zayvi payment platform for Nigeria. Kredal owns provider routing and can use Paystack or licensed partners underneath. Live checkout stays disabled until NGN catalogue pricing, signed webhooks and Kredal live credentials are verified.",
    },
    {
      name: "Square",
      market: "United Kingdom · GBP",
      status: "Disabled in Preview",
      note: "Existing UK card integration retained. Charges remain server-side blocked until the production checkout and fulfilment release gate is approved.",
    },
    {
      name: "PayPal",
      market: "International alternative",
      status: "Disabled in Preview",
      note: "Existing integration retained as an alternative payment route. Order creation and payment execution remain separated and server controlled.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Finance</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Payments
            </h1>
          </div>
          <a
            href="/admin/dashboard"
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Back to overview
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-800">
            Payment execution remains disabled
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-700">
            Zayvi can persist orders and payment-platform metadata in Preview,
            but no provider may charge a real customer until market pricing,
            signed provider verification, refunds and fulfilment gates pass the
            release checklist.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="rounded-2xl border border-gray-200 bg-white p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{provider.name}</h2>
                  <div className="mt-1 text-[11px] font-medium text-gray-400">
                    {provider.market}
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">
                  {provider.status}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-500">
                {provider.note}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold">Routing boundary</h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-600 md:grid-cols-3">
            <div className="rounded-xl bg-[#f7f8f6] p-4">
              <div className="font-semibold text-[#17251e]">Nigeria · NGN</div>
              <div className="mt-1 text-xs leading-5">Zayvi → Kredal Pay → provider rail</div>
            </div>
            <div className="rounded-xl bg-[#f7f8f6] p-4">
              <div className="font-semibold text-[#17251e]">UK · GBP</div>
              <div className="mt-1 text-xs leading-5">Zayvi → Square</div>
            </div>
            <div className="rounded-xl bg-[#f7f8f6] p-4">
              <div className="font-semibold text-[#17251e]">Alternative</div>
              <div className="mt-1 text-xs leading-5">Zayvi → PayPal</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
