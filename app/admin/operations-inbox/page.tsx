"use client";

import { useEffect, useMemo, useState } from "react";

type InboxItem = {
  id: string;
  type: "supplier_review" | "product_discovery" | "purchase_order" | "return";
  severity: "urgent" | "attention" | "action" | "review";
  baseSeverity: "urgent" | "attention" | "action" | "review";
  ageHours: number;
  targetHours: number | null;
  urgentAfterHours: number | null;
  escalationLabel?: string | null;
  overdue: boolean;
  overdueHours: number;
  title: string;
  detail: string;
  marketCode?: string | null;
  entityId: string;
  href: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type InboxResponse = {
  generatedAt: string;
  total: number;
  counts: {
    urgent: number;
    attention: number;
    action: number;
    review: number;
    overdue: number;
  };
  escalationPolicy: Record<
    string,
    { targetHours: number; urgentAfterHours: number; label: string }
  >;
  items: InboxItem[];
};

function severityClasses(value: InboxItem["severity"]) {
  if (value === "urgent") return "bg-red-50 text-red-700 border-red-100";
  if (value === "attention") return "bg-amber-50 text-amber-700 border-amber-100";
  if (value === "action") return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function typeLabel(value: InboxItem["type"]) {
  if (value === "supplier_review") return "Supplier";
  if (value === "product_discovery") return "Discovery";
  if (value === "purchase_order") return "Purchase order";
  return "Return";
}

function ageLabel(hours: number) {
  if (hours < 1) return "<1h";
  if (hours < 48) return Math.floor(hours) + "h";
  return (hours / 24).toFixed(1) + "d";
}

export default function OperationsInboxPage() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [severity, setSeverity] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/operations-inbox", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load operations inbox.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load operations inbox.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (data?.items ?? []).filter((item) => {
      const matchesSeverity = severity === "all" || item.severity === severity;
      const matchesType = type === "all" || item.type === type;
      const matchesQuery =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.detail.toLowerCase().includes(term);

      return matchesSeverity && matchesType && matchesQuery;
    });
  }, [data, severity, type, query]);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Operations inbox</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">Operations inbox</h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-[1450px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">Human-in-the-loop operations queue</div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            This inbox surfaces work that already exists in Zayvi. It does not approve suppliers,
            publish products, send purchase orders, receive inventory or process returns automatically.
            Open an item to complete the action in its controlled workspace.
          </p>
          <p className="mt-2 max-w-4xl text-[11px] leading-5 text-blue-700">
            Escalation is time-based and transparent: supplier verification targets 72h,
            product discovery 48h, supplier PO acknowledgement 24h, and return/refund
            follow-up 24h. Each item shows its own target and urgent threshold.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["urgent", "Urgent", data?.counts.urgent],
            ["attention", "Attention", data?.counts.attention],
            ["action", "Action", data?.counts.action],
            ["review", "Review", data?.counts.review],
            ["all", "Overdue", data?.counts.overdue],
          ].map(([value, label, count]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() =>
                String(label) === "Overdue"
                  ? setSeverity("all")
                  : setSeverity(String(value))
              }
              className="rounded-2xl border border-gray-200 bg-white p-5 text-left"
            >
              <div className="text-xs text-gray-400">{String(label)}</div>
              <div className="mt-2 text-3xl font-semibold">{count ?? "—"}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 lg:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search operational tasks"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="attention">Attention</option>
            <option value="action">Action</option>
            <option value="review">Review</option>
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">All workspaces</option>
            <option value="supplier_review">Suppliers</option>
            <option value="product_discovery">Discovery</option>
            <option value="purchase_order">Purchase orders</option>
            <option value="return">Returns</option>
          </select>
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading operations inbox...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <h2 className="text-base font-semibold">No matching operational work</h2>
            <p className="mt-2 text-sm text-gray-500">
              Clear the filters or refresh after new supplier, product, PO or return activity.
            </p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="divide-y divide-gray-100">
              {visible.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="grid gap-4 px-5 py-5 hover:bg-[#fafbf9] md:grid-cols-[120px_130px_minmax(0,1fr)_180px]"
                >
                  <div>
                    <span className={"inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize " + severityClasses(item.severity)}>
                      {item.severity}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-gray-500">
                    {typeLabel(item.type)}
                    {item.marketCode ? " · " + item.marketCode : ""}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#23432d]">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-gray-500">{item.detail}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                        age {ageLabel(item.ageHours)}
                      </span>
                      {item.targetHours !== null && (
                        <span
                          className={
                            "rounded-full px-2 py-1 " +
                            (item.overdue
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-600")
                          }
                        >
                          target {ageLabel(item.targetHours)}
                        </span>
                      )}
                      {item.urgentAfterHours !== null && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                          urgent at {ageLabel(item.urgentAfterHours)}
                        </span>
                      )}
                      {item.overdue && (
                        <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                          overdue {ageLabel(item.overdueHours)}
                        </span>
                      )}
                      {item.baseSeverity !== item.severity && (
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                          escalated from {item.baseSeverity}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 md:text-right">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "—"}
                    <div className="mt-1 font-semibold text-[#31543b]">Open workspace →</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {data?.generatedAt && (
          <div className="mt-4 text-right text-[11px] text-gray-400">
            {data.total} open item(s) · generated {new Date(data.generatedAt).toLocaleString("en-GB")}
          </div>
        )}
      </section>
    </main>
  );
}
