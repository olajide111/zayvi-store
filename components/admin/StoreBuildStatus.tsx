import Link from "next/link";
import { ALL_STUDIO_THEMES } from "@/lib/theme-registry";

export default function StoreBuildStatus() {
  const items = [
    { title: "Theme design", status: "Preview", description: `${ALL_STUDIO_THEMES.length} themes with editors and device demos. Drafts save on this browser. Store-backed activation and publishing are still required.`, href: "/admin/themes", action: "Explore themes" },
    { title: "Product discovery", status: "Review-first", description: "Supplier imports, candidate review and approval are connected. AI product research and candidate scoring are not yet available.", href: "/admin/discovery", action: "Review candidates" },
    { title: "Sourcing score", status: "Rules-based", description: "Ranks recorded stock, supplier verification, margin and lead time. This is not an AI demand prediction or a guarantee of profit.", href: "/admin/sourcing", action: "Compare sourcing" },
  ];
  return <section aria-labelledby="store-build-status" className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
    <h2 id="store-build-status" className="mb-3 text-lg font-semibold tracking-tight">Design and discovery</h2>
    <div className="grid gap-3 lg:grid-cols-3">{items.map((item) => <article key={item.href} className="flex min-w-0 flex-col rounded-2xl border border-[#dfe6e1] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.title}</h3><span className="rounded-md bg-[#f4f1e8] px-2 py-1 text-xs text-[#664f25]">{item.status}</span></div>
      <p className="mb-3 mt-2 text-sm leading-6 text-[#52635b]">{item.description}</p>
      <Link href={item.href} prefetch={false} className="mt-auto inline-flex min-h-11 items-center text-sm font-semibold text-[#215241] underline">{item.action}</Link>
    </article>)}</div>
    <Link href="/admin/system-readiness" prefetch={false} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[#215241] underline">Check deployed API and database readiness</Link>
  </section>;
}
