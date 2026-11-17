"use client";

import { use, useEffect, useState } from "react";

type SupplierInventorySyncRun = {
  id: string;
  sourceType: string;
  sourceReference?: string | null;
  itemCount: number;
  matchedCount: number;
  unmatchedCount: number;
  staleCount: number;
  status: string;
  createdAt: string;
};

type SupplierApiCredential = {
  id: string;
  supplierId: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  status: "active" | "revoked";
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type SupplierUser = {
  id: string;
  supplierId: string;
  email: string;
  displayName?: string | null;
  role: "owner" | "editor" | "viewer";
  status: "invited" | "active" | "revoked";
  inviteExpiresAt?: string | null;
  activatedAt?: string | null;
  lastLoginAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function SupplierPortalAccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [users, setUsers] = useState<SupplierUser[]>([]);
  const [credentials, setCredentials] = useState<SupplierApiCredential[]>([]);
  const [syncRuns, setSyncRuns] = useState<SupplierInventorySyncRun[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"owner" | "editor" | "viewer">("editor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [credentialLabel, setCredentialLabel] = useState("Supplier feed integration");
  const [credentialExpiryDays, setCredentialExpiryDays] = useState("90");
  const [credentialScope, setCredentialScope] = useState<"feed" | "inventory" | "both">("feed");
  const [newApiKey, setNewApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [userResponse, credentialResponse, syncResponse] = await Promise.all([
        fetch(`/api/admin/suppliers/${id}/users`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/admin/suppliers/${id}/api-credentials`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/admin/suppliers/${id}/inventory-sync`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (
        userResponse.status === 401 ||
        credentialResponse.status === 401 ||
        syncResponse.status === 401
      ) {
        window.location.href = "/admin";
        return;
      }

      const userPayload = await userResponse.json();
      const credentialPayload = await credentialResponse.json();
      const syncPayload = await syncResponse.json();

      if (!userResponse.ok) {
        throw new Error(userPayload?.error || "Unable to load vendor access.");
      }

      if (!credentialResponse.ok) {
        throw new Error(
          credentialPayload?.error || "Unable to load supplier API credentials."
        );
      }

      if (!syncResponse.ok) {
        throw new Error(
          syncPayload?.error || "Unable to load supplier inventory sync history."
        );
      }

      setUsers(Array.isArray(userPayload.users) ? userPayload.users : []);
      setCredentials(
        Array.isArray(credentialPayload.credentials)
          ? credentialPayload.credentials
          : []
      );
      setSyncRuns(Array.isArray(syncPayload.runs) ? syncPayload.runs : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load vendor access."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setNotice("");
    setInviteUrl("");
    setInviteExpiresAt("");

    try {
      const response = await fetch(
        `/api/admin/suppliers/${id}/users`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            displayName: displayName || null,
            role,
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to create vendor invitation."
        );
      }

      setInviteUrl(payload.inviteUrl || "");
      setInviteExpiresAt(payload.inviteExpiresAt || "");
      setNotice(
        "Vendor invitation created. The link is shown once below; share it only with the intended supplier user."
      );
      setEmail("");
      setDisplayName("");
      setRole("editor");
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create vendor invitation."
      );
    } finally {
      setWorking(false);
    }
  }

  async function revoke(accountId: string) {
    if (!window.confirm("Revoke this vendor user's portal access?")) return;

    setWorking(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/suppliers/${id}/users/${accountId}/revoke`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to revoke vendor access.");
      }

      setNotice("Vendor access revoked.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to revoke vendor access."
      );
    } finally {
      setWorking(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Invitation link copied.");
    } catch {
      setError("Unable to copy the invitation link. Select and copy it manually.");
    }
  }

  async function createApiCredential(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const days = credentialExpiryDays === "" ? null : Number(credentialExpiryDays);
    if (days !== null && (!Number.isSafeInteger(days) || days < 1 || days > 365)) {
      setError("API credential expiry must be between 1 and 365 days.");
      return;
    }

    setWorking(true);
    setError("");
    setNotice("");
    setNewApiKey("");

    try {
      const expiresAt =
        days === null
          ? null
          : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(
        `/api/admin/suppliers/${id}/api-credentials`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: credentialLabel,
            expiresAt,
            scopes:
              credentialScope === "both"
                ? ["feed:write", "inventory:write"]
                : credentialScope === "inventory"
                  ? ["inventory:write"]
                  : ["feed:write"],
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to create supplier API credential."
        );
      }

      setNewApiKey(payload.apiKey || "");
      setNotice(
        "Supplier API credential created. Copy the secret now; Zayvi does not store the raw key and cannot show it again."
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create supplier API credential."
      );
    } finally {
      setWorking(false);
    }
  }

  async function revokeApiCredential(credentialId: string) {
    if (!window.confirm("Revoke this supplier API credential immediately?")) {
      return;
    }

    setWorking(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/suppliers/${id}/api-credentials/${credentialId}/revoke`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to revoke supplier API credential."
        );
      }

      setNotice("Supplier API credential revoked.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to revoke supplier API credential."
      );
    } finally {
      setWorking(false);
    }
  }

  async function copyApiKey() {
    if (!newApiKey) return;

    try {
      await navigator.clipboard.writeText(newApiKey);
      setNotice("Supplier API key copied.");
    } catch {
      setError("Unable to copy the API key. Select and copy it manually.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202923]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5 md:px-9">
          <div>
            <a
              href={`/admin/suppliers/${id}`}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← Supplier
            </a>
            <h1 className="mt-1 text-xl font-semibold text-[#17251e]">
              Vendor portal access
            </h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-5 py-8 md:px-9">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-800">
            Invite-only supplier access
          </div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
            Vendor users can only view their supplier workspace and, unless they
            are viewers, update their own commercial offer data. They cannot
            verify suppliers, publish products, set customer prices, approve
            purchase orders or execute fulfilment.
          </p>
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {inviteUrl && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <div className="text-xs font-semibold text-amber-800">
              One-time invitation link
            </div>
            <div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-gray-700">
              {inviteUrl}
            </div>
            <div className="mt-2 text-[11px] text-amber-700">
              Expires{" "}
              {inviteExpiresAt
                ? new Date(inviteExpiresAt).toLocaleString("en-GB")
                : "within 48 hours"}
              . The token becomes invalid after activation.
            </div>
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="mt-3 rounded-lg bg-[#17251e] px-4 py-2 text-[11px] font-semibold text-white"
            >
              Copy invitation link
            </button>
          </div>
        )}

        <form
          onSubmit={createInvite}
          className="mt-6 rounded-2xl border border-gray-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold">Invite vendor user</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Vendor email"
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name (optional)"
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "owner" | "editor" | "viewer")
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm md:col-span-2"
            >
              <option value="owner">Owner — can update supplier offers</option>
              <option value="editor">Editor — can update supplier offers</option>
              <option value="viewer">Viewer — read only</option>
            </select>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={working}
              className="rounded-xl bg-[#17251e] px-5 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              Create invitation
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold">Supplier API credentials</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-400">
              Machine credentials are limited to supplier product-feed submission.
              Raw keys are shown once, stored only as hashes, and can be revoked immediately.
              Feed submissions still enter the Admin review queue and never auto-publish.
            </p>
          </div>

          {newApiKey && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="text-xs font-semibold text-amber-800">
                Copy this API key now
              </div>
              <div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-gray-700">
                {newApiKey}
              </div>
              <div className="mt-2 text-[11px] leading-4 text-amber-700">
                Endpoint: POST /api/vendor-feed/v1/ingest · Header:
                Authorization: Bearer &lt;API_KEY&gt;
              </div>
              <button
                type="button"
                onClick={() => void copyApiKey()}
                className="mt-3 rounded-lg bg-[#17251e] px-4 py-2 text-[11px] font-semibold text-white"
              >
                Copy API key
              </button>
            </div>
          )}

          <form onSubmit={createApiCredential} className="mt-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
              <input
                required
                value={credentialLabel}
                onChange={(event) => setCredentialLabel(event.target.value)}
                placeholder="Credential label"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
              <select
                value={credentialExpiryDays}
                onChange={(event) => setCredentialExpiryDays(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <option value="30">Expires in 30 days</option>
                <option value="90">Expires in 90 days</option>
                <option value="180">Expires in 180 days</option>
                <option value="365">Expires in 365 days</option>
                <option value="">No expiry</option>
              </select>
              <select
                value={credentialScope}
                onChange={(event) =>
                  setCredentialScope(
                    event.target.value as "feed" | "inventory" | "both"
                  )
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <option value="feed">Product feed only</option>
                <option value="inventory">Inventory sync only</option>
                <option value="both">Feed + inventory</option>
              </select>
              <button
                type="submit"
                disabled={working}
                className="rounded-xl bg-[#17251e] px-5 py-3 text-xs font-semibold text-white disabled:opacity-40"
              >
                Create API key
              </button>
            </div>
          </form>

          {credentials.length > 0 && (
            <div className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-100">
              {credentials.map((credential) => (
                <div
                  key={credential.id}
                  className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_160px_140px_120px]"
                >
                  <div>
                    <div className="text-sm font-semibold">{credential.label}</div>
                    <div className="mt-1 font-mono text-[11px] text-gray-400">
                      {credential.keyPrefix}••••••••
                    </div>
                    <div className="mt-1 text-[10px] text-gray-400">
                      Scope: {credential.scopes.join(", ")}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      Last used
                    </div>
                    <div className="mt-1">
                      {credential.lastUsedAt
                        ? new Date(credential.lastUsedAt).toLocaleString("en-GB")
                        : "Never"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      Expires
                    </div>
                    <div className="mt-1">
                      {credential.expiresAt
                        ? new Date(credential.expiresAt).toLocaleDateString("en-GB")
                        : "No expiry"}
                    </div>
                  </div>
                  <div className="md:text-right">
                    {credential.status === "active" ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void revokeApiCredential(credential.id)}
                        className="rounded-lg border border-red-100 px-3 py-2 text-[11px] font-semibold text-red-600 disabled:opacity-40"
                      >
                        Revoke key
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">Revoked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Supplier inventory sync history</h2>
            <p className="mt-1 text-xs text-gray-400">
              Supplier-reported stock evidence only. Owned inventory and publication are never changed by these syncs.
            </p>
          </div>

          {syncRuns.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No supplier inventory sync runs recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {syncRuns.slice(0, 10).map((run) => (
                <div
                  key={run.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_90px_90px_90px_120px]"
                >
                  <div>
                    <div className="text-sm font-semibold capitalize">
                      {run.status.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {run.sourceReference || run.sourceType} ·{" "}
                      {new Date(run.createdAt).toLocaleString("en-GB")}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-400">Matched</div>
                    <div className="mt-1 font-semibold">{run.matchedCount}</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-400">Unmatched</div>
                    <div className="mt-1 font-semibold">{run.unmatchedCount}</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-400">Stale</div>
                    <div className="mt-1 font-semibold">{run.staleCount}</div>
                  </div>
                  <div className="text-xs md:text-right">
                    <div className="text-gray-400">Items</div>
                    <div className="mt-1 font-semibold">{run.itemCount}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Vendor users</h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">
              Loading vendor users...
            </div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No vendor users have been invited yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_100px_110px_150px]"
                >
                  <div>
                    <div className="text-sm font-semibold">
                      {user.displayName || user.email}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {user.email}
                    </div>
                    {user.lastLoginAt && (
                      <div className="mt-1 text-[10px] text-gray-400">
                        Last login{" "}
                        {new Date(user.lastLoginAt).toLocaleString("en-GB")}
                      </div>
                    )}
                  </div>
                  <div className="text-xs capitalize text-gray-600">
                    {user.role}
                  </div>
                  <div className="text-xs capitalize text-gray-600">
                    {user.status}
                  </div>
                  <div className="md:text-right">
                    {user.status !== "revoked" ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void revoke(user.id)}
                        className="rounded-lg border border-red-100 px-3 py-2 text-[11px] font-semibold text-red-600 disabled:opacity-40"
                      >
                        Revoke access
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        Revoked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
