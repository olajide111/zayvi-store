"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export default function AdminSignOut({ className }: { className: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to sign out.");
      window.location.replace("/admin");
    } catch {
      setError("Unable to sign out. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button type="button" onClick={() => void signOut()} disabled={busy} className="flex min-h-11 w-full items-center gap-2.5 px-2 text-sm">
        <LogOut size={15} aria-hidden="true" /> {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert" className="px-2 pb-2 text-xs">{error}</p>}
    </div>
  );
}
