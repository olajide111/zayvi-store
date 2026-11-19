"use client";

import { ArrowDownRight, ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

export default function AdminSignIn({ destination }: { destination: string }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to sign in. Try again.");
      }
      window.location.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh grid-rows-[auto_1fr] bg-[#f5f7f3] font-sans text-[#172a21] md:grid-rows-1 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <header className="relative isolate flex flex-col justify-between overflow-hidden bg-[#142e26] px-5 py-5 text-white sm:px-9 md:min-h-dvh md:p-10 lg:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -bottom-48 -z-10 hidden size-[30rem] rounded-full border border-white/15 bg-[#254437] shadow-[0_0_0_3rem_#1d392e,0_0_0_6rem_#1a342a] md:block" />
        <Link href="/" className="flex w-fit items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-white">
          <span className="grid size-10 place-items-center rounded-xl bg-[#dce9d4] text-xl font-bold text-[#173a2e]" aria-hidden="true">Z</span>
          <span>
            <span className="block text-base leading-tight font-semibold">Zayvi Store</span>
            <span className="block text-xs text-[#b9cfc1]">Admin workspace</span>
          </span>
        </Link>
        <div className="relative hidden max-w-sm pb-3 md:block">
          <ArrowDownRight size={35} strokeWidth={1.2} className="mb-4 text-[#c9e0ca]" aria-hidden="true" />
          <p className="text-3xl leading-tight font-medium tracking-tight lg:text-4xl">Manage orders, products and fulfilment in one place.</p>
        </div>
      </header>

      <section aria-labelledby="admin-sign-in-title" className="flex flex-col justify-center px-5 py-9 sm:px-9 md:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h1 id="admin-sign-in-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Admin sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#52635b]">Enter your password to open the Zayvi workspace.</p>
          <form onSubmit={signIn} className="mt-7">
            <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold">Admin password</label>
            <div className="relative">
              <input
                id="admin-password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "admin-sign-in-error" : undefined}
                disabled={busy}
                required
                className="min-h-12 w-full rounded-xl border border-[#9eafa3] bg-white py-3 pr-14 pl-4 text-base focus:border-[#215241] focus:ring-2 focus:ring-[#215241]/25 focus:outline-none"
              />
              <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-[#52635b] hover:text-[#173a2e] focus-visible:ring-2 focus-visible:ring-[#215241]">
                {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {error && <p id="admin-sign-in-error" role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
            <button disabled={busy} type="submit" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#215241] px-4 text-sm font-semibold text-white hover:bg-[#173a2e] focus-visible:ring-2 focus-visible:ring-[#215241] focus-visible:ring-offset-2 disabled:opacity-70">
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
          <Link href="/" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-[#215241] hover:underline focus-visible:ring-2 focus-visible:ring-[#215241]">
            <ArrowLeft size={15} aria-hidden="true" /> Back to storefront
          </Link>
        </div>
      </section>
    </main>
  );
}
