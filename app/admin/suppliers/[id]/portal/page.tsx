"use client";

import { use, useEffect, useState } from "react";

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
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"owner" | "editor" | "viewer">("editor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/suppliers/${id}/users`,
        { credentials: "include", cache: "no-store" }
      );

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load vendor access.");
      }

      setUsers(Array.isArray(payload.users) ? payload.users : []);
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
