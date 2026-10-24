"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = "checking" | "paid" | "pending" | "failed";

const COPY: Record<Status, { icon: string; title: string; body: string }> = {
  checking: { icon: "⏳", title: "We're checking your payment", body: "This only takes a moment. Please don't pay again." },
  paid: { icon: "✅", title: "Order confirmed", body: "Your payment has been received. PayPal will email you a receipt. If you have any questions, email hello@zayvi.store." },
  pending: { icon: "⏳", title: "We're checking your payment", body: "We couldn't confirm your payment yet. Please don't pay again — check your PayPal account for the payment, or email hello@zayvi.store and we'll confirm your order." },
  failed: { icon: "⚠️", title: "Payment not completed", body: "We couldn't take this payment, so no order was placed. You can try again from your basket, or email hello@zayvi.store if money has left your account." },
};

export default function PaymentStatus({ orderId }: { orderId: string | null }) {
  const [status, setStatus] = useState<Status>(orderId ? "checking" : "failed");

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then((r) => r.json())
      .then((d: { status?: string }) => {
        if (cancelled) return;
        setStatus(d.status === "paid" || d.status === "failed" ? d.status : "pending");
      })
      .catch(() => { if (!cancelled) setStatus("pending"); });
    return () => { cancelled = true; };
  }, [orderId]);

  const c = COPY[status];
  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", padding: 40, maxWidth: 520 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>{c.icon}</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", marginBottom: 10 }}>{c.title}</h1>
        <p style={{ fontSize: 16, color: "#777", marginBottom: 32, lineHeight: 1.6 }}>{c.body}</p>
        {status !== "checking" && (
          <Link href="/" style={{ background: "#111", color: "#fff",
            padding: "14px 32px", borderRadius: 10, textDecoration: "none",
            fontSize: 14, fontWeight: 700 }}>
            {status === "failed" ? "Back to the store" : "Continue Shopping"}
          </Link>
        )}
      </div>
    </div>
  );
}
