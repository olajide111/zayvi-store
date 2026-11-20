import { DIRECTION_CATALOGUE } from "@/lib/storefront-theme-directions";

/**
 * Read-only gallery of the additional storefront directions. It lives beside
 * the existing Themes & Layouts page and does not change it. Nothing here can
 * be published; the directions are contracts until a renderer is approved.
 */
export default function AdminThemeDirectionsPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Storefront / Themes</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Additional directions</h1>
          </div>
          <a href="/admin/themes" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">Back to themes</a>
        </div>
      </header>
      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs leading-5 text-amber-800">
          Six additional, interactive design previews ported from the supplied desktop and mobile boards. All imagery and prices are sample content. Owner review is required before merge; publishing is not connected.
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DIRECTION_CATALOGUE.map((d) => (
            <article key={d.family} className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold">{d.name}</h2>
              <p className="mt-2 text-xs leading-5 text-gray-500">{d.description}</p>
              <div className="mt-3 text-[11px] text-gray-400">{d.recommendedFor.join(" · ")}</div>
              <div className="mt-4 flex gap-1.5" aria-label="Default colours">
                {d.colourTokens.map((t) => (
                  <span key={t} title={t} className="h-6 w-6 rounded-full border border-gray-200" style={{ backgroundColor: d.defaultColours[t] }} />
                ))}
              </div>
              <dl className="mt-4 space-y-1 text-xs text-gray-500">
                <div className="flex justify-between"><dt>Builds on</dt><dd className="font-medium text-gray-700">{d.baseFamily}</dd></div>
                <div className="flex justify-between"><dt>Fonts</dt><dd className="font-medium text-gray-700">{d.headingFont}{d.bodyFont !== d.headingFont ? " + " + d.bodyFont : ""}</dd></div>
              </dl>
              <a href={`/admin/themes/directions/${d.family}`} className="mt-4 inline-block rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">Open preview</a>
              <div className="mt-4 text-xs font-semibold text-gray-700">Needs from the catalogue</div>
              <ul className="mt-1 list-disc pl-4 text-xs leading-5 text-gray-500">
                {d.requires.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
