"use client";

import { useEffect, useState } from "react";

type MigrationReadiness = {
  name: string;
  feature: string;
  description: string;
  applied: boolean;
  appliedAt?: string | null;
};

type ReadinessResponse = {
  source: string;
  generatedAt: string;
  readinessSource: "schema_markers";
  allReady: boolean;
  appliedCount: number;
  pendingCount: number;
  latestAppliedMigration?: string | null;
  requiredMigrations: MigrationReadiness[];
};

export default function SystemReadinessPage() {
  const [data, setData] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/system-readiness", {
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
          throw new Error(payload?.error || "Unable to load system readiness.");
        }

        return payload;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Unable to load system readiness."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1300px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <div className="text-xs text-gray-400">Workspace / System readiness</div>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              System readiness
            </h1>
          </div>
          <a
            href="/admin/dashboard"
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Back to overview
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-[1300px] px-5 py-8 md:px-9">
        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">
            Checking schema readiness...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div
              className={
                "rounded-2xl border p-5 " +
                (data.allReady
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-amber-100 bg-amber-50")
              }
            >
              <div
                className={
                  "text-sm font-semibold " +
                  (data.allReady ? "text-emerald-800" : "text-amber-800")
                }
              >
                {data.allReady
                  ? "Preview schema is ready for all currently built operations"
                  : "Preview schema is behind the current application"}
              </div>
              <p
                className={
                  "mt-1 max-w-4xl text-xs leading-5 " +
                  (data.allReady ? "text-emerald-700" : "text-amber-700")
                }
              >
                This status is verified from the PostgreSQL tables and columns each
                migration creates. Pending features should not be treated as activated
                until their migrations are applied through the reviewed Preview bootstrap process.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs text-gray-400">Applied</div>
                <div className="mt-2 text-3xl font-semibold">{data.appliedCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs text-gray-400">Pending</div>
                <div className="mt-2 text-3xl font-semibold">{data.pendingCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs text-gray-400">Latest applied</div>
                <div className="mt-2 break-all text-sm font-semibold">
                  {data.latestAppliedMigration || "None recorded"}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold">Feature migration readiness</h2>
                <p className="mt-1 text-xs text-gray-400">
                  Current application features that depend on migrations 0011–0019. Readiness is based on actual schema markers, not privileged migration-ledger access.
                </p>
              </div>

              <div className="divide-y divide-gray-100">
                {data.requiredMigrations.map((migration) => (
                  <div
                    key={migration.name}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[170px_minmax(0,1fr)_220px]"
                  >
                    <div>
                      <div className="text-sm font-semibold">{migration.feature}</div>
                      <div className="mt-1 font-mono text-[11px] text-gray-400">
                        {migration.name}
                      </div>
                    </div>

                    <div className="text-xs leading-5 text-gray-500">
                      {migration.description}
                    </div>

                    <div className="md:text-right">
                      <span
                        className={
                          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                          (migration.applied
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700")
                        }
                      >
                        {migration.applied ? "Applied" : "Pending"}
                      </span>
                      {migration.appliedAt && (
                        <div className="mt-1 text-[10px] text-gray-400">
                          {new Date(migration.appliedAt).toLocaleString("en-GB")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Activation rule</h2>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Use the Preview database migration runbook and the existing authenticated
                Terraform/bootstrap path. Do not enable live payment, automatic fulfilment,
                supplier submission or automatic reordering merely because application code
                has been merged.
              </p>
              <a
                href="https://github.com/olajide111/zayvi-store/blob/main/docs/runbooks/preview-database-migrations.md"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-semibold text-[#31543b] hover:underline"
              >
                Open Preview migration runbook →
              </a>
            </div>

            <div className="mt-4 text-right text-[11px] text-gray-400">
              Generated {new Date(data.generatedAt).toLocaleString("en-GB")}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
