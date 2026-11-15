"use client";

import { useState } from "react";
import {
  DEFAULT_THEME_CONFIG,
  TEMPLATE_CATALOGUE,
  PALETTE_PRESETS,
  FONT_PRESETS,
  type TemplateFamily,
  type PalettePreset,
  type FontPreset,
} from "@/lib/storefront-theme";

export default function AdminThemesPage() {
  const [family, setFamily] = useState<TemplateFamily>(DEFAULT_THEME_CONFIG.template.family);
  const [palette, setPalette] = useState<PalettePreset>(DEFAULT_THEME_CONFIG.brand.palette);
  const [headingFont, setHeadingFont] = useState<FontPreset>(DEFAULT_THEME_CONFIG.brand.headingFont);
  const [bodyFont, setBodyFont] = useState<FontPreset>(DEFAULT_THEME_CONFIG.brand.bodyFont);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Storefront</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Themes & Layouts</h1>
          </div>
          <a href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">Back to overview</a>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5">
          <div className="text-sm font-semibold text-[#23432d]">Storefront design studio</div>
          <p className="mt-1 text-xs leading-5 text-[#55705b]">
            Preview the supported Zayvi theme system safely. Draft selections here are visual only until theme publishing is enabled.
          </p>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Template family</h2>
                <p className="mt-1 text-xs text-gray-400">Choose an approved storefront starting point.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Draft preview</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {TEMPLATE_CATALOGUE.map((template) => {
                const active = template.family === family;
                return (
                  <button
                    key={template.family}
                    type="button"
                    onClick={() => setFamily(template.family)}
                    className={`rounded-2xl border p-5 text-left transition ${active ? "border-[#6f8b75] bg-[#f0f5f0]" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="text-sm font-semibold">{template.name}</div>
                    <p className="mt-2 text-xs leading-5 text-gray-500">{template.description}</p>
                    <div className="mt-3 text-[11px] text-gray-400">{template.recommendedFor.join(" · ")}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold">Brand settings</h2>
            <p className="mt-1 text-xs text-gray-400">Safe token-based styling only.</p>

            <label className="mt-5 block text-xs font-semibold text-gray-500">Palette</label>
            <select value={palette} onChange={(e) => setPalette(e.target.value as PalettePreset)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              {PALETTE_PRESETS.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}
            </select>

            <label className="mt-5 block text-xs font-semibold text-gray-500">Heading font</label>
            <select value={headingFont} onChange={(e) => setHeadingFont(e.target.value as FontPreset)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              {FONT_PRESETS.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}
            </select>

            <label className="mt-5 block text-xs font-semibold text-gray-500">Body font</label>
            <select value={bodyFont} onChange={(e) => setBodyFont(e.target.value as FontPreset)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              {FONT_PRESETS.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}
            </select>

            <div className="mt-6 rounded-xl bg-[#f7f8f6] p-4">
              <div className="text-xs font-semibold text-gray-700">Current draft</div>
              <div className="mt-3 space-y-2 text-xs text-gray-500">
                <div className="flex justify-between"><span>Template</span><span className="font-medium text-gray-700">{family}</span></div>
                <div className="flex justify-between"><span>Palette</span><span className="font-medium text-gray-700">{palette}</span></div>
                <div className="flex justify-between"><span>Product layout</span><span className="font-medium text-gray-700">{DEFAULT_THEME_CONFIG.storefront.productLayout}</span></div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
