export default function AdminSettingsPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div><div className="text-xs text-gray-400">Workspace / Platform</div><h1 className="mt-1 text-xl font-semibold text-[#17251e]">Settings</h1></div>
          <a href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">Back to overview</a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="text-xs font-semibold tracking-[0.14em] text-gray-400">STORE</div>
            <h2 className="mt-2 text-lg font-semibold">ZAYVI</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Environment</span><span className="font-medium">Preview</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Primary market</span><span className="font-medium">United Kingdom</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Primary currency</span><span className="font-medium">GBP</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Purchasing</span><span className="font-medium text-amber-700">Disabled</span></div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="text-xs font-semibold tracking-[0.14em] text-gray-400">BACKEND</div>
            <h2 className="mt-2 text-lg font-semibold">AWS Preview</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Database</span><span className="font-medium text-emerald-700">PostgreSQL connected</span></div>
              <div className="flex justify-between"><span className="text-gray-500">API</span><span className="font-medium text-emerald-700">IAM protected</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tenant</span><span className="font-medium">zayvi</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Production</span><span className="font-medium">Untouched</span></div>
            </div>
          </section>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold">Launch readiness</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Store settings become editable once the customer storefront is reading from PostgreSQL and the order, shipping and payment launch checks are complete.</p>
        </div>
      </section>
    </main>
  );
}
