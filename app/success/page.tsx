"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PaymentResult = {
  success: boolean;
  orderId?: string;
  captureId?: string;
  paymentId?: string;
  amount?: string;
  currency?: string;
  error?: string;
};

export default function Success() {
  const [state, setState] = useState<"checking" | "confirmed" | "failed">("checking");
  const [payment, setPayment] = useState<PaymentResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    const squarePaymentId = params.get("payment_id");
    const paypalOrderId = params.get("token");

    const endpoint = provider === "square" ? "/api/square/verify" : "/api/paypal/capture";
    const payload = provider === "square"
      ? { paymentId: squarePaymentId }
      : { orderId: paypalOrderId };

    if ((provider === "square" && !squarePaymentId) || (provider !== "square" && !paypalOrderId)) {
      setPayment({ success: false, error: "We could not find a payment reference. No payment confirmation is available." });
      setState("failed");
      return;
    }

    let active = true;
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Payment verification failed.");
        if (active) {
          setPayment(data);
          setState("confirmed");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setPayment({ success: false, error: error instanceof Error ? error.message : "Payment verification failed." });
          setState("failed");
        }
      });

    return () => { active = false; };
  }, []);

  const confirmed = state === "confirmed";
  const checking = state === "checking";

  return (
    <main style={{ minHeight: "100vh", background: "#f8f8f6", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <section style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 20, padding: "48px 32px", textAlign: "center", boxShadow: "0 12px 48px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 48, marginBottom: 18 }}>{checking ? "…" : confirmed ? "✓" : "!"}</div>
        <h1 style={{ fontSize: 26, fontWeight: 850, color: "#111", marginBottom: 12 }}>
          {checking ? "Verifying your payment" : confirmed ? "Payment confirmed" : "Payment not confirmed"}
        </h1>
        <p style={{ fontSize: 15, color: "#666", lineHeight: 1.7, marginBottom: 22 }}>
          {checking
            ? "Please wait while we confirm the payment directly with your payment provider. Do not refresh or place another order yet."
            : confirmed
              ? "Your payment provider has confirmed that your payment was completed. Keep the reference below if you need to contact us."
              : payment?.error || "We could not verify the payment. Please contact support before trying again."}
        </p>
        {confirmed && payment && (
          <div style={{ background: "#f7f7f5", borderRadius: 12, padding: 16, marginBottom: 24, textAlign: "left", fontSize: 13, color: "#555", lineHeight: 1.8 }}>
            {payment.orderId && <div><strong>PayPal order:</strong> {payment.orderId}</div>}
            {payment.paymentId && <div><strong>Square payment:</strong> {payment.paymentId}</div>}
            <div><strong>Payment:</strong> £{payment.amount}</div>
            {payment.captureId && <div><strong>Capture reference:</strong> {payment.captureId}</div>}
          </div>
        )}
        <Link href="/" style={{ display: "inline-block", background: "#111", color: "#fff", padding: "13px 28px", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
          Return to ZAYVI
        </Link>
        <p style={{ marginTop: 22, fontSize: 12, color: "#999" }}>Need help? hello@zayvi.store</p>
      </section>
    </main>
  );
}
