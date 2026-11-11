"use client";

import { useEffect, useState } from "react";

type DashboardData = {
  store: {
    name: string;
    status: string;
    purchasingEnabled: boolean;
  };
  catalogue: {
    totalProducts: number;
    categories: string[];
  };
  payments: {
    status: string;
    providers: { name: string; status: string }[];
  };
  markets: {
    code: string;
    name: string;
    currency: string;
  }[];
  theme: {
    template: { family: string; version: string };
    brand: {
      palette: string;
      headingFont: string;
      bodyFont: string;
    };
  };
  availableTemplates: {
    family: string;
    name: string;
    description: string;
    recommendedFor: string[];
  }[];
};

const navigation = [
  {
    group: "COMMERCE",
    items: [
      ["Overview", "◫", "/admin/dashboard"],
      ["Orders", "▤", "#"],
      ["Products & Catalogue", "◇", "#"],
      ["Inventory", "▦", "#"],
      ["Customers", "♙", "#"],
      ["Suppliers", "⌑", "#"],
    ],
  },
  {
    group: "STOREFRONT",
    items: [
      ["Themes & Layouts", "▧", "#"],
      ["Page Builder", "▤", "#"],
      ["Navigation & Menus", "☷", "#"],
      ["Banners & Media", "▧", "/admin"],
      ["Custom Pages", "▤", "#"],
    ],
  },
  {
    group: "FINANCE",
    items: [
      ["Payments", "◉", "#"],
      ["Payouts & Settlements", "⇄", "#"],
      ["Financial Reports", "▥", "#"],
    ],
  },
  {
    group: "GROWTH",
    items: [
      ["Marketing", "↗", "#"],
      ["Promotions & Discounts", "%", "#"],
      ["Shipping & Returns", "⇢", "#"],
    ],
  },
  {
    group: "INTELLIGENCE",
    items: [
      ["Sales Analytics", "⌁", "#"],
      ["Product Intelligence", "✧", "#"],
      ["Forecasting", "⌇", "#"],
    ],
  },
  {
    group: "PLATFORM",
    items: [
      ["Markets & Currencies", "◎", "#"],
      ["Integrations Hub", "⌘", "#"],
      ["Team & Permissions", "♧", "#"],
      ["Settings", "⚙", "#"],
    ],
  },
];

function Status({ children }: { children: string }) {
  const positive = ["active", "enabled", "ready"].includes(
    children.toLowerCase()
  );

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          positive ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {String(children ?? "unknown").replaceAll("_", " ")}
    </span>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/admin/dashboard", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.href = "/admin";
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load dashboard information.");
        }

        const result: DashboardData = await response.json();
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong loading the dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6]">
        <div className="text-sm text-gray-500">Loading your workspace...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] p-6">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">
            Dashboard unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {error || "We could not retrieve your store information."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-[#17251e] px-5 py-2.5 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[258px] flex-col border-r border-white/10 bg-[#17251e] text-white lg:flex">
        <div className="flex h-[76px] items-center border-b border-white/10 px-7">
          <div>
            <div className="text-xl font-semibold tracking-[0.18em]">
              ZAYVI
            </div>
            <div className="mt-0.5 text-[10px] tracking-[0.2em] text-white/45">
              COMMERCE PLATFORM
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-white/40">
            WORKSPACE
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.07] px-3 py-3">
            <div>
              <div className="text-sm font-medium">Zayvi Store</div>
              <div className="mt-1 text-xs text-white/45">Main store</div>
            </div>
            <span className="text-white/50">⌄</span>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {navigation.map((section) => (
            <div key={section.group}>
              <div className="mb-2 px-3 text-[10px] font-semibold tracking-[0.15em] text-white/35">
                {section.group}
              </div>
              <div className="space-y-1">
                {section.items.map(([label, icon, href]) => {
                  const active = label === "Overview";
                  return (
                    <a
                      key={label}
                      href={href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${
                        active
                          ? "bg-[#d8e7d9] font-semibold text-[#17251e]"
                          : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <span className="w-5 text-center text-base">{icon}</span>
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-5">
          <div className="text-xs text-white/45">Zayvi Commerce</div>
          <div className="mt-1 text-xs text-white/65">Platform preview</div>
        </div>
      </aside>

      <section className="lg:pl-[258px]">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-gray-200 bg-white/90 px-5 backdrop-blur-md md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Overview</div>
            <div className="mt-1 text-sm font-semibold">Store overview</div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Image uploader
            </a>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e5ede5] text-sm font-semibold text-[#31543b]">
              Z
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-9 md:py-10">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="text-sm text-gray-500">Good to see you</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#17251e]">
                Welcome to Zayvi.
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                Manage your commerce operations, catalogue, storefront and
                international markets from one workspace.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Status>preview</Status>
              <span className="text-xs text-gray-400">Store environment</span>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#dce7dc] bg-[#edf4ed] p-5 md:flex md:items-center md:justify-between md:px-7">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg text-[#31543b]">
                !
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#23432d]">
                  Your store is currently in preview mode
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[#55705b]">
                  Product and market information is being prepared. Checkout
                  and payment processing remain disabled until fulfilment,
                  policies and payment configuration are verified.
                </p>
              </div>
            </div>
            <span className="mt-4 inline-block text-xs font-semibold text-[#31543b] md:mt-0">
              Purchasing disabled
            </span>
          </div>

          <div className="mt-9">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Store at a glance</h2>
              <span className="text-xs text-gray-400">
                Current configuration
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Catalogue products",
                  value: data.catalogue.totalProducts.toString(),
                  note: "Products currently configured",
                  icon: "◇",
                },
                {
                  label: "Product categories",
                  value: data.catalogue.categories.length.toString(),
                  note: "Categories represented",
                  icon: "▦",
                },
                {
                  label: "Markets configured",
                  value: data.markets.length.toString(),
                  note: "UK and Nigeria",
                  icon: "◎",
                },
                {
                  label: "Payment providers",
                  value: data.payments.providers.length.toString(),
                  note: "Configuration records",
                  icon: "⇄",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-gray-200 bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      {metric.label}
                    </span>
                    <span className="text-lg text-[#66816b]">
                      {metric.icon}
                    </span>
                  </div>
                  <div className="mt-5 text-3xl font-semibold tracking-tight">
                    {metric.value}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {metric.note}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-9 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Market setup</h2>
                  <p className="mt-1 text-xs text-gray-400">
                    Configured commerce regions
                  </p>
                </div>
                <span className="text-xs text-gray-400">02 markets</span>
              </div>

              <div className="mt-5 divide-y divide-gray-100">
                {data.markets.map((market) => (
                  <div
                    key={market.code}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f4f0] text-xs font-semibold text-[#31543b]">
                        {market.code}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {market.name}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          Market currency
                        </div>
                      </div>
                    </div>
                    <span className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                      {market.currency}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold">Payment configuration</h2>
              <p className="mt-1 text-xs text-gray-400">
                Provider readiness
              </p>
              <div className="mt-5 space-y-4">
                {data.payments.providers.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">
                      {provider.name}
                    </span>
                    <Status>{provider.status}</Status>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-[#f7f8f6] p-4">
                <div className="text-xs font-semibold text-gray-700">
                  Payments are not active
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Provider setup and end-to-end payment testing are still
                  required before checkout can be enabled.
                </p>
              </div>
            </section>
          </div>

          <div className="mt-9">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Storefront foundation</h2>
              <p className="mt-1 text-xs text-gray-400">
                Your current theme configuration and available design systems
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <section className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="text-xs font-medium text-gray-400">
                  CURRENT THEME
                </div>
                <h3 className="mt-3 text-xl font-semibold capitalize">
                  {String(data.theme?.template?.family ?? "editorial").replaceAll("-", " ")}
                </h3>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Colour palette</span>
                    <span className="font-medium capitalize">
                      {String(data.theme?.brand?.palette ?? "warm-neutral").replaceAll("-", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Heading font</span>
                    <span className="font-medium">
                      {data.theme?.brand?.headingFont ?? "modern-sans"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Body font</span>
                    <span className="font-medium">{data.theme?.brand?.bodyFont ?? "modern-sans"}</span>
                  </div>
                </div>
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <a
                    href="#theme-library"
                    className="text-xs font-semibold text-[#31543b] hover:underline"
                  >
                    Explore theme library →
                  </a>
                </div>
              </section>

              <section
                id="theme-library"
                className="rounded-2xl border border-gray-200 bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Available templates</h3>
                  <span className="text-xs text-gray-400">
                    {data.availableTemplates.length} design systems
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {data.availableTemplates.map((template) => (
                    <div
                      key={template.family}
                      className="rounded-xl border border-gray-100 bg-[#fafbf9] p-4"
                    >
                      <div className="text-sm font-semibold">
                        {template.name}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        {template.description}
                        <div className="mt-2 text-[11px] text-gray-400">
                          {template.recommendedFor?.join(" · ") ?? ""}
                        </div>
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <footer className="mt-12 border-t border-gray-200 py-6 text-xs text-gray-400">
            Zayvi Commerce Platform · Store configuration overview
          </footer>
        </div>
      </section>
    </main>
  );
}
