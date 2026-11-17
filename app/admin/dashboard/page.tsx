"use client";

import Link from "next/link";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CircleAlert, CircleCheck,
  ClipboardList, ExternalLink, Inbox, RefreshCw, ShoppingBag,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { adminGroups, adminPrimary } from "@/components/admin/admin-navigation";

const markets = [
  { code: "GB", name: "United Kingdom", shortName: "UK", currency: "GBP" },
  { code: "NG", name: "Nigeria", shortName: "Nigeria", currency: "NGN" },
] as const;

type MarketCode = (typeof markets)[number]["code"];
type MarketFilter = MarketCode | "all";

type MarketMetric = {
  marketCode: string;
  currency: string;
  orderCount: number;
  paidOrders: number;
  paidValue: number;
};

type Analytics = {
  markets: MarketMetric[];
  recentOrders: {
    id: string;
    orderNumber: string;
    marketCode: string;
    currency: string;
    total: number;
    paymentStatus: string;
    fulfilmentStatus: string;
    createdAt: string;
  }[];
};

type Operations = {
  total: number;
  counts: { urgent: number; overdue: number };
  items: {
    id: string;
    title: string;
    detail: string;
    href: string;
    severity: "urgent" | "attention" | "action" | "review";
    overdue: boolean;
  }[];
};

type StockWatch = {
  items: {
    tenantProductId: string;
    inventoryLevelId: string | null;
    productName: string;
    locationName: string | null;
    availableToSell: number | null;
    severity: "setup" | "critical" | "warning";
  }[];
};

type Source<T> =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; data: T };

const panelClass = "min-w-0 rounded-[22px] border border-[#dfe6e1] bg-white shadow-[0_2px_8px_#173b2810]";
const quietLink = "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#215241] hover:text-[#112c22]";
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London",
});

function useDashboardSource<T>(url: string, revision: number): Source<T> {
  const [result, setResult] = useState<{ revision: number; source: Source<T> } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 15_000);

    async function load() {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          if (active) window.location.replace("/admin?next=dashboard");
          return;
        }
        if (!response.ok) throw new Error("Dashboard source unavailable.");
        const data: T = await response.json();

        if (active) {
          setResult({ revision, source: { status: "ready", data } });
        }
      } catch {
        if (active) {
          setResult({ revision, source: { status: "unavailable" } });
        }
      } finally {
        window.clearTimeout(timer);
      }
    }

    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [url, revision]);

  return result?.revision === revision ? result.source : { status: "loading" };
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
  }).format(value);
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function PanelHeading({ title, subtitle, href, linkLabel }: {
  title: string;
  subtitle?: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-3 sm:px-5 sm:pt-4">
      <div className="pt-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-[#52635b]">{subtitle}</p>}
      </div>
      <Link href={href} prefetch={false} className={quietLink}>
        {linkLabel}<ArrowUpRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

function PanelNotice({ children }: { children: ReactNode }) {
  return <p role="status" className="px-4 py-5 text-sm text-[#52635b] sm:px-5">{children}</p>;
}

function DashboardSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-[#142e26] text-white lg:flex">
      <Link href="/admin/dashboard" className="mx-4 mt-4 mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-[#dce9d4] text-lg font-bold text-[#173a2e]" aria-hidden="true">Z</span>
        <span>
          <span className="block text-sm font-semibold">Zayvi Store</span>
          <span className="block text-xs text-[#b0c6b8]">Admin workspace</span>
        </span>
      </Link>
      <nav aria-label="Admin sidebar" className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {[{ label: "Workspace", items: adminPrimary }, ...adminGroups].map(({ label, items }) => (
          <div key={label}>
            <p className="mb-1.5 px-3 text-xs font-medium text-[#acc6b8]">{label}</p>
            <div className="space-y-0.5">
              {items.map(({ title, href, icon: Icon }) => {
                const active = href === "/admin/dashboard";
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    aria-current={active ? "page" : undefined}
                    className={"flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] " +
                      (active ? "bg-[#e1eedc] font-semibold text-[#173a2e]" : "text-[#dfebe3] hover:bg-white/10")}
                  >
                    <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                    {title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <Link href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border-t border-white/15 px-7 py-4 text-sm text-[#dfebe3] hover:bg-white/10">
        <ExternalLink size={16} aria-hidden="true" /> View storefront
      </Link>
    </aside>
  );
}

function OperationsPanel({ source }: { source: Source<Operations> }) {
  return (
    <section className={panelClass + " min-h-52 overflow-hidden"} aria-labelledby="attention-heading">
      <div className="bg-gradient-to-br from-[#183e30] to-[#255441] px-4 py-4 text-white sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/12"><Inbox size={19} aria-hidden="true" /></span>
            <h2 id="attention-heading" className="text-base font-semibold tracking-tight sm:text-lg">Needs attention</h2>
          </div>
          <Link href="/admin/operations-inbox" prefetch={false} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg text-xs font-semibold text-[#eff8eb] hover:underline">
            Open inbox <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {source.status === "ready" && (
          <p className="mt-2 text-xs text-[#d4e7da]">
            {source.data.total} open{" · "}{source.data.counts.urgent} urgent
            {Number.isFinite(source.data.counts.overdue) ? " · " + source.data.counts.overdue + " overdue" : ""}
          </p>
        )}
      </div>
      {source.status === "loading" && <PanelNotice>Checking the operations inbox…</PanelNotice>}
      {source.status === "unavailable" && <PanelNotice>Inbox data is unavailable. Open the inbox for details.</PanelNotice>}
      {source.status === "ready" && (
        source.data.items.length ? (
          <ul className="divide-y divide-[#e8ede9] px-4 sm:px-5">
            {source.data.items.slice(0, 3).map((item) => (
              <li key={item.id}>
                <Link href={item.href} prefetch={false} className="group flex min-h-14 items-center gap-3 rounded-md py-2.5 hover:bg-[#f5f8f5]">
                  <span className={"grid size-8 shrink-0 place-items-center rounded-lg " + (item.severity === "urgent" || item.overdue ? "bg-[#faeee4] text-[#93401d]" : "bg-[#eaf2ec] text-[#25604a]")}>
                    {item.severity === "urgent" || item.overdue ? <CircleAlert size={16} aria-hidden="true" /> : <ClipboardList size={16} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold break-words">{item.title}</span>
                    <span className="line-clamp-2 text-xs break-words text-[#52635b]">
                      {item.severity === "urgent" ? "Urgent · " : item.overdue ? "Overdue · " : ""}{item.detail}
                    </span>
                  </span>
                  <ArrowRight className="shrink-0 text-[#52635b] group-hover:text-[#215241]" size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : <PanelNotice><CircleCheck size={16} className="mr-2 inline text-[#25604a]" aria-hidden="true" />No open items in the operations inbox.</PanelNotice>
      )}
    </section>
  );
}

function PerformancePanel({ source, market }: { source: Source<Analytics>; market: MarketFilter }) {
  const selectedMarkets = market === "all" ? markets : markets.filter(({ code }) => code === market);

  return (
    <section className={panelClass}>
      <PanelHeading title="Market performance" subtitle="All-time Preview orders, including test activity" href="/admin/analytics" linkLabel="Analytics" />
      {source.status === "loading" && <PanelNotice>Loading sales and order totals…</PanelNotice>}
      {source.status === "unavailable" && <PanelNotice>Sales and order totals are unavailable.</PanelNotice>}
      {source.status === "ready" && (
        <div className={"grid gap-3 px-4 pt-4 pb-4 sm:px-5 sm:pb-5 " + (market === "all" ? "min-[375px]:grid-cols-2" : "")}>
          {selectedMarkets.map(({ code, name, shortName, currency }) => {
            const metric = source.data.markets.find((item) => item.marketCode === code && item.currency === currency);
            const orderCount = metric?.orderCount ?? 0;
            const paidOrders = metric?.paidOrders ?? 0;
            const paidPercent = orderCount > 0 ? Math.round(paidOrders / orderCount * 100) : 0;
            return (
              <div key={code} className="min-w-0 rounded-2xl border border-[#e3ebe4] bg-[#f5f8f3] px-3 py-3.5 sm:px-4 sm:py-4">
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  <span className="font-semibold text-[#294538]"><span className="sm:hidden">{shortName}</span><span className="hidden sm:inline">{name}</span></span>
                  <span className="rounded-md bg-[#e5eee4] px-1.5 py-0.5 font-semibold text-[#305844]">{currency}</span>
                </div>
                <div className="mt-2.5 text-[clamp(1.05rem,4.6vw,1.75rem)] font-semibold leading-tight tracking-tight break-words tabular-nums" aria-label={money(metric?.paidValue ?? 0, currency) + " paid order value"}>
                  {money(metric?.paidValue ?? 0, currency)}
                </div>
                <p className="mt-0.5 text-xs text-[#52635b]">Paid order value</p>
                <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dce7dd]">
                  <div className="h-full rounded-full bg-[#3b795c]" style={{ width: paidPercent + "%" }} />
                </div>
                <p className="mt-2 text-xs font-medium text-[#52635b]">{paidOrders} paid / {orderCount} orders</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OrdersPanel({ source, market }: { source: Source<Analytics>; market: MarketFilter }) {
  const orders = source.status === "ready" ? source.data.recentOrders
    .filter((order) => market === "all" || order.marketCode === market)
    .slice(0, 5) : [];

  return (
    <section className={panelClass + " lg:col-start-1"}>
      <PanelHeading title="Recent orders" subtitle={market === "all" ? "Latest recorded activity" : "Selected market in the latest store activity"} href="/admin/orders" linkLabel="All orders" />
      {source.status === "loading" && <PanelNotice>Loading recent orders…</PanelNotice>}
      {source.status === "unavailable" && <PanelNotice>Recent orders are unavailable.</PanelNotice>}
      {source.status === "ready" && (orders.length ? (
        <ul className="mt-2 divide-y divide-[#e8ede9] px-4 pb-2 sm:px-5">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={"/admin/orders/" + encodeURIComponent(order.id)} prefetch={false} className="group flex min-h-[64px] items-center gap-2.5 rounded-md py-2 hover:bg-[#f5f8f5]">
                <span className="hidden size-9 shrink-0 place-items-center rounded-lg bg-[#edf3ee] text-[#33644e] sm:grid">
                  <ShoppingBag size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" title={order.orderNumber}>{order.orderNumber}</span>
                  <span className="block truncate text-xs text-[#52635b]">{order.marketCode} · <time dateTime={order.createdAt}>{dateFormatter.format(new Date(order.createdAt))}</time></span>
                </span>
                <span className="hidden max-w-30 truncate text-xs capitalize text-[#52635b] md:block">{statusLabel(order.fulfilmentStatus)}</span>
                <span className="flex max-w-[48%] shrink-0 flex-col items-end gap-1 text-right">
                  <span className="text-sm font-semibold break-words tabular-nums">{money(order.total, order.currency)}</span>
                  <span className={"max-w-full rounded-md px-1.5 py-0.5 text-[11px] leading-tight font-semibold capitalize " +
                    (order.paymentStatus === "paid" ? "bg-[#e6f0e9] text-[#215241]" : order.paymentStatus === "failed" ? "bg-[#faeee4] text-[#93401d]" : "bg-[#eff2ef] text-[#52635b]")}>
                    {statusLabel(order.paymentStatus)}
                  </span>
                </span>
                <ArrowUpRight className="hidden shrink-0 text-[#52635b] group-hover:text-[#215241] sm:block" size={15} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : <PanelNotice>No orders in this view.</PanelNotice>)}
    </section>
  );
}

function InventoryPanel({ sources, market }: { sources: Record<MarketCode, Source<StockWatch>>; market: MarketFilter }) {
  const selectedMarkets = market === "all" ? markets : markets.filter(({ code }) => code === market);

  return (
    <section className={panelClass + " lg:col-start-2"}>
      <PanelHeading title="Stock watch" href="/admin/replenishment" linkLabel="Watchlist" />
      <div className="grid gap-2.5 px-4 pt-2 pb-4 sm:px-5 sm:pb-5">
        {selectedMarkets.map(({ code, name }) => {
          const source = sources[code];
          const items = source.status === "ready" ? source.data.items : [];
          const alerts = items.filter((item) => item.severity !== "setup")
            .sort((left, right) => Number(right.severity === "critical") - Number(left.severity === "critical"));
          const setupCount = items.length - alerts.length;
          return (
            <div key={code} className="rounded-xl border border-[#e3ebe4] bg-[#f8faf7] p-3">
              <h3 className="text-sm font-semibold">{name}</h3>
              {source.status === "loading" && <p className="mt-1 text-xs text-[#52635b]" role="status">Checking stock…</p>}
              {source.status === "unavailable" && <p className="mt-1 text-xs text-[#52635b]" role="status">Stock watch is unavailable.</p>}
              {source.status === "ready" && (
                <>
                  <p className="mt-1 text-xs text-[#52635b]">
                    {alerts.length === 0 ? "No alerts for tracked stock" : alerts.length + (alerts.length === 1 ? " inventory alert" : " inventory alerts")}
                    {setupCount > 0 && " · " + setupCount + " untracked"}
                  </p>
                  {alerts.length > 0 && (
                    <ul className="mt-2.5 space-y-2">
                      {alerts.slice(0, 2).map((item) => (
                        <li key={item.inventoryLevelId ?? item.tenantProductId} className="flex gap-2 text-xs">
                          <ArrowDownRight size={15} className="shrink-0 text-[#93401d]" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold" title={item.productName}>{item.productName}</span>
                            {item.locationName && <span className="block truncate text-[#52635b]">{item.locationName}</span>}
                          </span>
                          <span className="shrink-0 text-[#93401d]">{item.availableToSell ?? "—"} available</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const [revision, setRevision] = useState(0);
  const [market, setMarket] = useState<MarketFilter>("all");
  const operations = useDashboardSource<Operations>("/api/admin/operations-inbox", revision);
  const analytics = useDashboardSource<Analytics>("/api/admin/analytics", revision);
  const stockGB = useDashboardSource<StockWatch>("/api/admin/replenishment?market=GB", revision);
  const stockNG = useDashboardSource<StockWatch>("/api/admin/replenishment?market=NG", revision);
  const loading = [operations, analytics, stockGB, stockNG].some((source) => source.status === "loading");

  return (
    <main className="min-h-screen bg-[#f2f5f1] font-sans text-[#172a21]">
      <DashboardSidebar />
      <div className="lg:pl-60">
        <header className="flex min-h-14 items-center justify-between gap-2 border-b border-[#dfe6e1] bg-white px-4 sm:px-7 lg:px-8">
          <span className="text-sm font-semibold lg:hidden">Zayvi Store</span>
          <span className="hidden text-sm font-medium text-[#52635b] lg:inline">Workspace <span aria-hidden="true">/</span> Overview</span>
          <div className="flex items-center gap-2.5">
            <Link href="/admin/system-readiness" prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#52635b] hover:text-[#215241]">
              <span className="size-1.5 rounded-full bg-[#92713f]" aria-hidden="true" /> Preview
            </Link>
            <button
              type="button"
              aria-label={loading ? "Refreshing dashboard" : "Refresh dashboard"}
              aria-busy={loading}
              disabled={loading}
              onClick={() => setRevision((previous) => previous + 1)}
              className="grid size-11 place-items-center rounded-xl text-[#215241] hover:bg-[#edf3ee] disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? "motion-safe:animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1490px] px-4 pt-5 pb-8 sm:px-7 sm:pt-7 lg:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
            <div>
              <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-tight font-semibold tracking-[-0.045em]">Store overview</h1>
              <p className="mt-1 text-sm text-[#52635b]">Orders, stock and outstanding work.</p>
            </div>
            <Link href="/admin/operations-audit" prefetch={false} className="hidden min-h-11 items-center gap-2 rounded-xl border border-[#dbe5dd] bg-white px-3 text-sm font-semibold text-[#215241] hover:bg-[#eaf2ec] sm:inline-flex">
              Operations audit <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <OperationsPanel source={operations} />
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div role="group" aria-label="Market filter" className="inline-flex max-w-full gap-0.5 rounded-xl border border-[#dfe6e1] bg-white p-1">
                  {([{ code: "all", shortName: "All markets" }, ...markets] as const).map(({ code, shortName }) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={market === code}
                      onClick={() => setMarket(code)}
                      className={"min-h-11 rounded-lg px-2.5 whitespace-nowrap sm:px-3.5 " +
                        (market === code ? "bg-[#e6f0e9] text-[#16372e]" : "text-[#52635b] hover:bg-[#f1f5f2]")}
                    >
                      <span className="text-xs font-semibold">{shortName}</span>
                    </button>
                  ))}
                </div>
                <Link className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#215241] sm:hidden" href="/admin/operations-audit" prefetch={false}>
                  Audit <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </div>
              <PerformancePanel source={analytics} market={market} />
            </div>
            <OrdersPanel source={analytics} market={market} />
            <InventoryPanel sources={{ GB: stockGB, NG: stockNG }} market={market} />
          </div>
        </div>
      </div>
    </main>
  );
}
