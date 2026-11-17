"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VendorActivatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Activating your supplier access...");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setError("This vendor invitation link is incomplete.");
      setStatus("");
      return;
    }

    async function activate() {
      try {
        const response = await fetch("/api/vendor/activate", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to activate vendor access.");
        }

        setStatus("Access activated. Opening your supplier workspace...");
        router.replace("/vendor");
      } catch (err) {
        setStatus("");
        setError(
          err instanceof Error
            ? err.message
            : "Unable to activate vendor access."
        );
      }
    }

    void activate();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f3] px-5 text-[#202923]">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#63806b]">
          Zayvi Supplier Portal
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Vendor access</h1>

        {status && (
          <div className="mt-6 rounded-2xl bg-[#f3f7f2] p-5 text-sm leading-6 text-[#31543b]">
            {status}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm leading-6 text-red-700">
            {error}
          </div>
        )}

        <p className="mt-6 text-xs leading-5 text-gray-400">
          Vendor access is invitation-only. Product publication, supplier verification,
          purchasing and fulfilment decisions remain controlled by Zayvi Admin.
        </p>
      </section>
    </main>
  );
}
