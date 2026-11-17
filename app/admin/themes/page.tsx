"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";
import { PRODUCTS } from "@/lib/products";
import {
  DEFAULT_THEME_CONFIG, TEMPLATE_CATALOGUE, PALETTE_PRESETS, FONT_PRESETS,
  type TemplateFamily, type PalettePreset, type FontPreset,
} from "@/lib/storefront-theme";

const colours: Record<PalettePreset, { canvas: string; ink: string; accent: string; accentInk: string }> = {
  "warm-neutral": { canvas: "#f5f0e8", ink: "#30281f", accent: "#504332", accentInk: "#ffffff" },
  "cool-minimal": { canvas: "#edf3f6", ink: "#182e42", accent: "#224d6c", accentInk: "#ffffff" },
  ink: { canvas: "#222824", ink: "#f5f7ef", accent: "#e4eddd", accentInk: "#172a21" },
  forest: { canvas: "#edf4e9", ink: "#173a2e", accent: "#215241", accentInk: "#ffffff" },
  "merchant-custom": { canvas: "#f5edf0", ink: "#402d3a", accent: "#653b54", accentInk: "#ffffff" },
};

const fonts: Record<FontPreset, string> = {
  "editorial-serif": "Georgia, serif",
  "modern-sans": "var(--font-geist-sans), Arial, sans-serif",
  "geometric-sans": "Century Gothic, Futura, Arial, sans-serif",
};

const examples: Record<TemplateFamily, { heading: string; description: string; action: string; productIndex: number; layout: string }> = {
  editorial: { heading: "Everyday essentials", description: "A collection for wherever the day takes you.", action: "Explore the collection", productIndex: 0, layout: "grid sm:grid-cols-2" },
  "general-commerce": { heading: "Shop the essentials", description: "Browse popular products and find the right fit.", action: "Browse products", productIndex: 0, layout: "grid sm:grid-cols-[1.25fr_1fr]" },
  "product-specification": { heading: "AeroBottle Travel Bottle", description: "Insulated steel · 24h cold · 12h hot", action: "View specifications", productIndex: 0, layout: "grid sm:grid-cols-[1fr_1.15fr] sm:[&>img]:order-first" },
  grocery: { heading: "Shop by department", description: "A category-led layout for grocery and convenience stores.", action: "Browse departments", productIndex: 0, layout: "grid sm:grid-cols-[1.45fr_1fr]" },
  "home-furniture": { heading: "Make yourself at home", description: "Discover a collection made for daily comfort.", action: "Explore home essentials", productIndex: 2, layout: "grid sm:grid-cols-[1fr_1.45fr]" },
  wholesale: { heading: "Wholesale catalogue", description: "Browse the range and enquire about trade orders.", action: "View trade catalogue", productIndex: 0, layout: "grid sm:grid-cols-[1.35fr_1fr] sm:[&>img]:order-first" },
};

const labelClass = "block text-xs font-semibold text-[#52635b]";
const controlClass = "mt-1.5 min-h-11 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm";

export default function AdminThemesPage() {
  const [family, setFamily] = useState<TemplateFamily>(DEFAULT_THEME_CONFIG.template.family);
  const [palette, setPalette] = useState<PalettePreset>(DEFAULT_THEME_CONFIG.brand.palette);
  const [headingFont, setHeadingFont] = useState<FontPreset>(DEFAULT_THEME_CONFIG.brand.headingFont);
  const [bodyFont, setBodyFont] = useState<FontPreset>(DEFAULT_THEME_CONFIG.brand.bodyFont);
  const selected = colours[palette];
  const example = examples[family];
  const sample = PRODUCTS[example.productIndex];

  function resetPreview() {
    setFamily(DEFAULT_THEME_CONFIG.template.family);
    setPalette(DEFAULT_THEME_CONFIG.brand.palette);
    setHeadingFont(DEFAULT_THEME_CONFIG.brand.headingFont);
    setBodyFont(DEFAULT_THEME_CONFIG.brand.bodyFont);
  }

  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Store" title="Themes & layouts" description="Try template, colour and type choices in a storefront preview.">
        <Link href="/" prefetch={false} target="_blank" rel="noopener noreferrer" className={adminAction}>Open storefront</Link>
      </AdminPageHeading>

      <div className="mx-auto grid max-w-[1500px] items-start gap-4 px-4 py-5 sm:px-7 lg:px-8 xl:grid-cols-[minmax(255px,0.7fr)_minmax(0,1.3fr)]">
        <section className="min-w-0 rounded-xl border border-[#dfe6e1] bg-white p-4 sm:p-5" aria-label="Theme settings">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Theme settings</h2>
            <button type="button" onClick={resetPreview} aria-label="Reset preview" className="grid size-10 place-items-center rounded-lg text-[#215241] hover:bg-[#edf4ee]">
              <RotateCcw size={17} aria-hidden="true" />
            </button>
          </div>
          <label className={labelClass + " sm:hidden"}>
            Template
            <select className={controlClass} value={family} onChange={(event) => setFamily(event.target.value as TemplateFamily)}>
              {TEMPLATE_CATALOGUE.map((template) => <option key={template.family} value={template.family}>{template.name}</option>)}
            </select>
          </label>
          <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-1">
            {TEMPLATE_CATALOGUE.map((template) => (
              <button key={template.family} type="button" aria-pressed={template.family === family} onClick={() => setFamily(template.family)} className="rounded-lg border border-[#dfe6e1] p-3 text-left hover:bg-[#f5f8f5] aria-pressed:border-[#769681] aria-pressed:bg-[#edf4ee]">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {template.name}
                  {template.family === family && <Check size={16} className="shrink-0 text-[#215241]" aria-hidden="true" />}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-[#52635b]">{template.description}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <label className={labelClass}>
              Palette
              <select className={controlClass} value={palette} onChange={(event) => setPalette(event.target.value as PalettePreset)}>
                {PALETTE_PRESETS.map((item) => <option key={item} value={item}>{item === "merchant-custom" ? "custom sample" : item.replaceAll("-", " ")}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Heading font
              <select className={controlClass} value={headingFont} onChange={(event) => setHeadingFont(event.target.value as FontPreset)}>
                {FONT_PRESETS.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Body font
              <select className={controlClass} value={bodyFont} onChange={(event) => setBodyFont(event.target.value as FontPreset)}>
                {FONT_PRESETS.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-[#dfe6e1] bg-white xl:sticky xl:top-5" aria-label="Storefront preview">
          <div className="border-b border-[#dfe6e1] px-4 py-3.5 sm:px-5">
            <h2 className="font-semibold">Storefront preview</h2>
            <p className="mt-1 text-xs text-[#52635b]">Selections apply to this sample while the page is open.</p>
          </div>
          <div data-preview-palette={palette} style={{ backgroundColor: selected.canvas, color: selected.ink, fontFamily: fonts[bodyFont] }}>
            <p className="border-b border-current/15 px-4 py-3 text-sm font-bold tracking-widest sm:px-6">{DEFAULT_THEME_CONFIG.brand.displayName}</p>
            <div className={example.layout}>
              <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-8">
                <h3 className="text-3xl leading-tight font-semibold break-words" style={{ fontFamily: fonts[headingFont] }}>{example.heading}</h3>
                <p className="mt-3 text-sm leading-relaxed">{example.description}</p>
                <span className="mt-5 inline-flex rounded-md px-3 py-2 text-xs font-semibold" style={{ backgroundColor: selected.accent, color: selected.accentInk }}>{example.action}</span>
              </div>
              <img src={sample.image} alt={sample.name} className="h-40 w-full bg-white/10 object-cover sm:h-full sm:min-h-52" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
