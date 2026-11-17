export default function VendorAccessRequiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f3] px-5 text-[#202923]">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#63806b]">
          Zayvi Supplier Portal
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Invitation required</h1>
        <p className="mt-4 text-sm leading-6 text-gray-600">
          Supplier access is invite-only. Use the activation link provided by Zayvi Admin.
          If your access was revoked or your invitation expired, contact the Zayvi team for
          a new invitation.
        </p>
      </section>
    </main>
  );
}
