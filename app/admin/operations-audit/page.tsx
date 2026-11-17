"use client";

import { useEffect, useMemo, useState } from "react";

type AuditEvent = {
  id: string;
  actorType: "admin" | "vendor" | "system";
  actorReference?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  marketCode?: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type AuditResponse = {
  generatedAt: string;
  total: number;
  events: AuditEvent[];
};

function actorClasses(actorType: AuditEvent["actorType"]) {
  if (actorType === "admin") return "bg-blue-50 text-blue-700";
  if (actorType === "vendor") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

export default function OperationsAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("all");
  const [entity, setEntity] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/operations-audit", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin";
          return null;
        }

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load operations audit.");
        }

        return payload as AuditResponse;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Unable to load operations audit."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const entityTypes = useMemo(
    () =>
      Array.from(
        new Set((data?.events ?? []).map((event) => event.entityType))
      ).sort(),
    [data]
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (data?.events ?? []).filter((event) => {
      const matchesActor = actor === "all" || event.actorType === actor;
      const matchesEntity = entity === "all" || event.entityType === entity;
      const matchesQuery =
        !term ||
        event.summary.toLowerCase().includes(term) ||
        event.action.toLowerCase().includes(term) ||
        (event.actorReference || "").toLowerCase().includes(term);

      return matchesActor && matchesEntity && matchesQuery;
    });
  }, [data, query, actor, entity]);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / Operations audit</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Operations audit
            </h1>
          </div>
          <a
            href="/admin/operations-inbox"
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Operations inbox
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1450px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">
            Append-only operational evidence
          </div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            This timeline records critical Admin and vendor actions across supplier
            verification, discovery decisions, purchase orders and returns. The
            application role can insert and read events, but cannot update or delete
            historical audit entries.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Recorded events</div>
            <div className="mt-2 text-3xl font-semibold">{data?.total ?? "—"}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Admin events</div>
            <div className="mt-2 text-3xl font-semibold">
              {data?.events.filter((event) => event.actorType === "admin").length ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-400">Vendor events</div>
            <div className="mt-2 text-3xl font-semibold">
              {data?.events.filter((event) => event.actorType === "vendor").length ?? "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 lg:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search action, summary or actor"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />
          <select
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">All actors</option>
            <option value="admin">Admin</option>
            <option value="vendor">Vendor</option>
            <option value="system">System</option>
          </select>
          <select
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">All entity types</option>
            {entityTypes.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading operations audit...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <h2 className="text-base font-semibold">No matching audit events</h2>
            <p className="mt-2 text-sm text-gray-500">
              Events are recorded prospectively after migration 0024 is active.
            </p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="divide-y divide-gray-100">
              {visible.map((event) => (
                <details key={event.id} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="grid gap-3 md:grid-cols-[100px_190px_minmax(0,1fr)_190px] md:items-start">
                      <div>
                        <span
                          className={
                            "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize " +
                            actorClasses(event.actorType)
                          }
                        >
                          {event.actorType}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold capitalize text-gray-600">
                          {event.entityType.replaceAll("_", " ")}
                        </div>
                        <div className="mt-1 text-[10px] text-gray-400">
                          {event.marketCode || "No market"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#23432d]">
                          {event.summary}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-gray-400">
                          {event.action}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 md:text-right">
                        {new Date(event.createdAt).toLocaleString("en-GB")}
                        <div className="mt-1">
                          {event.actorReference || "No actor reference"}
                        </div>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-4 rounded-xl bg-[#fafbf9] p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      Audit metadata
                    </div>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-gray-600">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                    {event.entityId && (
                      <div className="mt-3 font-mono text-[10px] text-gray-400">
                        Entity ID: {event.entityId}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {data?.generatedAt && (
          <div className="mt-4 text-right text-[11px] text-gray-400">
            Showing {visible.length} of {data.total} event(s) · generated{" "}
            {new Date(data.generatedAt).toLocaleString("en-GB")}
          </div>
        )}
      </section>
    </main>
  );
}
