"use client";

import { useMemo, useState } from "react";
import {
  ZDX_SAMPLE_DEPARTMENTS,
  ZDX_SAMPLE_PRODUCTS,
  zdxFormatPrice,
  type ZdxMarket,
  type ZdxSampleProduct,
} from "./zdx-sample-data";

type ZdxScreen = "home" | "collection" | "product" | "bag";
type ZdxBagLine = { id: string; quantity: number };

const art = (p: ZdxSampleProduct) => ({
  background: `radial-gradient(circle at 50% 46%, ${p.tint[1]} 0 26%, transparent 27%), linear-gradient(160deg, ${p.tint[0]}, #fff 130%)`,
});

/**
 * Modern African marketplace direction, preview only.
 * Uses sample data, Tailwind utilities and local state. It reads nothing from
 * the catalogue, writes nothing, and adds no global CSS or fonts.
 */
export default function ZdxMarketplacePreview() {
  const [screen, setScreen] = useState<ZdxScreen>("home");
  const [market, setMarket] = useState<ZdxMarket>("GB");
  const [department, setDepartment] = useState<string>("All");
  const [focusId, setFocusId] = useState(ZDX_SAMPLE_PRODUCTS[0].id);
  const [bag, setBag] = useState<ZdxBagLine[]>([{ id: "s1", quantity: 1 }, { id: "s5", quantity: 1 }]);

  const byId = (id: string) => ZDX_SAMPLE_PRODUCTS.find((p) => p.id === id)!;
  const focus = byId(focusId);
  const count = bag.reduce((n, l) => n + l.quantity, 0);
  const total = bag.reduce((n, l) => n + (market === "NG" ? byId(l.id).priceNgn : byId(l.id).priceGbp) * l.quantity, 0);
  const money = (v: number) => (market === "NG" ? "₦" + v.toLocaleString("en-GB") : "£" + v.toLocaleString("en-GB"));
  const shown = useMemo(
    () => ZDX_SAMPLE_PRODUCTS.filter((p) => department === "All" || p.department === department),
    [department]
  );
  const groups = useMemo(() => {
    const m = new Map<string, ZdxBagLine[]>();
    for (const l of bag) {
      const seller = ZDX_SAMPLE_PRODUCTS.find((p) => p.id === l.id)!.seller;
      m.set(seller, [...(m.get(seller) ?? []), l]);
    }
    return [...m.entries()];
  }, [bag]);

  const add = (id: string) =>
    setBag((b) => (b.some((l) => l.id === id) ? b.map((l) => (l.id === id ? { ...l, quantity: l.quantity + 1 } : l)) : [...b, { id, quantity: 1 }]));
  const change = (id: string, d: number) =>
    setBag((b) => b.map((l) => (l.id === id ? { ...l, quantity: l.quantity + d } : l)).filter((l) => l.quantity > 0));
  const open = (id: string) => { setFocusId(id); setScreen("product"); };

  const card = (p: ZdxSampleProduct) => (
    <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-[#e4e7e2] bg-white transition hover:-translate-y-1 hover:shadow-lg">
      <button type="button" onClick={() => open(p.id)} className="block h-40 w-full" style={art(p)} aria-label={p.name} />
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <div className="min-h-9 text-sm font-semibold leading-snug">{p.name}</div>
        <div className="text-lg font-extrabold">{zdxFormatPrice(p, market)}</div>
        <div className="text-xs text-[#55605a]">{p.seller}</div>
        <button type="button" onClick={() => add(p.id)} className="mt-2 min-h-11 rounded-lg border-2 border-[#0b5d3b] text-sm font-extrabold text-[#0b5d3b]">Quick add</button>
      </div>
    </div>
  );

  return (
    <div className="bg-[#fafbf8] text-[#1a1a1a]" data-zdx-direction="modern-marketplace">
      <div className="flex items-center justify-between bg-[#0b5d3b] px-4 py-2 text-xs font-semibold text-white md:px-10">
        <span>Sample content. Delivery and returns are shown at checkout.</span>
        <span className="flex overflow-hidden rounded-full border border-white/70">
          {(["GB", "NG"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMarket(m)} aria-pressed={market === m}
              className={`min-h-9 px-3 font-bold ${market === m ? "bg-white text-[#0b5d3b]" : ""}`}>{m === "GB" ? "UK £" : "Nigeria ₦"}</button>
          ))}
        </span>
      </div>

      <header className="flex flex-wrap items-center gap-3 border-b border-[#e4e7e2] bg-white px-4 py-3 md:px-10">
        <button type="button" onClick={() => setScreen("home")} className="text-3xl font-extrabold tracking-tight text-[#0b5d3b]">soko<span className="text-[#f2a900]">.</span></button>
        <div className="flex h-12 min-w-[200px] flex-1 overflow-hidden rounded-lg border-2 border-[#0b5d3b]">
          <input aria-label="Search" placeholder="Search products, brands and sellers" className="flex-1 px-4 text-sm outline-none" />
          <button type="button" onClick={() => setScreen("collection")} className="bg-[#0b5d3b] px-5 text-sm font-extrabold text-white">Search</button>
        </div>
        <button type="button" onClick={() => setScreen("bag")} className="min-h-12 rounded-lg bg-[#0b5d3b] px-5 text-sm font-extrabold text-white">Bag · {count}</button>
      </header>
      <nav aria-label="Departments" className="flex gap-1 overflow-x-auto border-b border-[#e4e7e2] bg-white px-3 text-sm font-bold md:px-9">
        {ZDX_SAMPLE_DEPARTMENTS.map((d) => (
          <button key={d} type="button" onClick={() => { setDepartment(d); setScreen("collection"); }} className="min-h-11 whitespace-nowrap px-3">{d}</button>
        ))}
      </nav>

      {screen === "home" && (
        <div className="space-y-8 px-4 py-6 md:px-10">
          <section className="relative flex min-h-[220px] flex-col justify-end gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b5d3b] to-[#1f8f5f] p-8 text-white">
            <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-[#f2a900]" />
            <div className="relative text-xs font-extrabold tracking-widest">SAMPLE PROMOTION</div>
            <div className="relative max-w-lg text-4xl font-extrabold leading-tight">Everyday home, handpicked from our sellers</div>
            <button type="button" onClick={() => { setDepartment("Home"); setScreen("collection"); }} className="relative min-h-11 self-start rounded-lg bg-[#f2a900] px-6 text-sm font-extrabold text-[#1a1a1a]">Shop home</button>
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-extrabold">Picked for you</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{ZDX_SAMPLE_PRODUCTS.map(card)}</div>
          </section>
        </div>
      )}

      {screen === "collection" && (
        <div className="grid gap-6 px-4 py-6 md:grid-cols-[240px_1fr] md:px-10">
          <aside aria-label="Filters" className="h-fit rounded-xl border border-[#e4e7e2] bg-white p-5">
            <div className="mb-2 text-sm font-extrabold">Department</div>
            {ZDX_SAMPLE_DEPARTMENTS.map((d) => (
              <button key={d} type="button" onClick={() => setDepartment(d)} aria-pressed={department === d}
                className={`block min-h-11 w-full rounded-lg px-2 text-left text-sm ${department === d ? "bg-[#e6f2eb] font-extrabold" : "font-semibold"}`}>{d}</button>
            ))}
          </aside>
          <div>
            <h1 className="mb-4 text-3xl font-extrabold">{department === "All" ? "All departments" : department} <span className="text-sm font-semibold text-[#55605a]">· {shown.length} sample items</span></h1>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{shown.map(card)}</div>
          </div>
        </div>
      )}

      {screen === "product" && (
        <div className="grid gap-8 px-4 py-6 md:grid-cols-[1fr_1fr_320px] md:px-10">
          <div className="h-[420px] rounded-xl" style={art(focus)} />
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#0b5d3b]">{focus.seller}</div>
            <h1 className="text-3xl font-extrabold leading-tight">{focus.name}</h1>
            <div className="text-3xl font-extrabold">{zdxFormatPrice(focus, market)}</div>
            <p className="text-base leading-relaxed text-[#2b332d]">{focus.description}</p>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 border-t border-[#e4e7e2] pt-3 text-sm"><dt className="font-bold">Department</dt><dd>{focus.department}</dd><dt className="font-bold">Seller</dt><dd>{focus.seller}</dd><dt className="font-bold">Details</dt><dd>{focus.detail}</dd></dl>
          </div>
          <aside aria-label="Buy" className="h-fit space-y-3 rounded-xl border-2 border-[#e4e7e2] bg-white p-5">
            <div className="text-2xl font-extrabold">{zdxFormatPrice(focus, market)}</div>
            <p className="text-xs text-[#55605a]">Delivery and returns for this seller are shown at checkout for your market.</p>
            <button type="button" onClick={() => { add(focus.id); setScreen("bag"); }} className="min-h-12 w-full rounded-lg bg-[#f2a900] text-base font-extrabold">Add to bag</button>
          </aside>
        </div>
      )}

      {screen === "bag" && (
        <div className="grid gap-6 px-4 py-6 md:grid-cols-[1fr_360px] md:px-10">
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold">Your bag · {count} items</h1>
            {groups.map(([seller, lines]) => (
              <section key={seller} className="overflow-hidden rounded-xl border border-[#e4e7e2] bg-white">
                <div className="bg-[#f2f4ef] px-5 py-3 text-sm font-extrabold">Sold by {seller}</div>
                {lines.map((l) => {
                  const p = byId(l.id);
                  return (
                    <div key={l.id} className="grid grid-cols-[72px_1fr_auto] items-center gap-4 border-t border-[#e4e7e2] px-5 py-3">
                      <div className="h-[72px] rounded-lg" style={art(p)} />
                      <div>
                        <div className="text-sm font-bold">{p.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <button type="button" aria-label="Remove one" onClick={() => change(l.id, -1)} className="h-11 w-11 rounded-lg border-2 border-[#0b5d3b]">−</button>
                          <span className="w-5 text-center font-extrabold">{l.quantity}</span>
                          <button type="button" aria-label="Add one" onClick={() => change(l.id, 1)} className="h-11 w-11 rounded-lg border-2 border-[#0b5d3b]">+</button>
                        </div>
                      </div>
                      <div className="text-lg font-extrabold">{zdxFormatPrice(p, market, l.quantity)}</div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
          <aside aria-label="Order summary" className="h-fit space-y-3 rounded-xl border-2 border-[#e4e7e2] bg-white p-6">
            <div className="text-xl font-extrabold">Order summary</div>
            <div className="flex justify-between text-sm"><span>Items</span><span>{money(total)}</span></div>
            <div className="flex justify-between text-sm text-[#55605a]"><span>Delivery</span><span>At checkout</span></div>
            <div className="text-xs text-[#55605a]">Each seller ships their own items, so delivery is worked out per seller at checkout. Preview only: nothing can be bought here.</div>
          </aside>
        </div>
      )}
    </div>
  );
}
