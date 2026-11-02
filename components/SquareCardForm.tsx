"use client";

import { useState, useEffect } from "react";

type Props = {
  amount: number;
  items: { id: number; qty: number }[];
  onSuccess: () => void;
  onError: (msg: string) => void;
};

declare global {
  interface Window {
    Square?: any;
  }
}

export default function SquareCardForm({ amount, items, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [card, setCard] = useState<any>(null);
  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const environment = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    let cardInstance: any;

    const init = async () => {
      try {
        if (!window.Square) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = environment === "production"
              ? "https://web.squarecdn.com/v1/square.js"
              : "https://sandbox.web.squarecdn.com/v1/square.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Square"));
            document.head.appendChild(script);
          });
        }
        if (cancelled || !window.Square) return;
        const payments = window.Square.payments(appId, process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID);
        cardInstance = await payments.card();
        await cardInstance.attach("#square-card-container");
        if (!cancelled) {
          setCard(cardInstance);
          setReady(true);
        }
      } catch (error) {
        console.error("Square card initialisation failed", error);
        if (!cancelled) onError("Card payments are temporarily unavailable. Please try PayPal or try again later.");
      }
    };

    init();
    return () => {
      cancelled = true;
      if (cardInstance?.destroy) cardInstance.destroy().catch(() => undefined);
    };
  }, [appId, environment, onError]);

  const handlePay = async () => {
    if (!card || loading || amount <= 0) return;
    setLoading(true);
    try {
      const result = await card.tokenize();
      if (result.status !== "OK" || !result.token) {
        onError(result.errors?.[0]?.message || "Please check your card details.");
        return;
      }

      const res = await fetch("/api/square", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: result.token, items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Card payment failed. Please try again.");
      onSuccess();
      if (data.redirect) window.location.assign(data.redirect);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Card payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!appId) {
    return (
      <p style={{ fontSize: 12, color: "#777", lineHeight: 1.5, marginTop: 12 }}>
        Card payments will be available here once Square is configured.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Pay securely by card</div>
      <div id="square-card-container" style={{ minHeight: 90, padding: 12, border: "1px solid #e5e5e5", borderRadius: 10, background: "#fff" }} />
      <button
        type="button"
        onClick={handlePay}
        disabled={!ready || loading}
        style={{
          width: "100%", marginTop: 12, background: !ready || loading ? "#777" : "#111",
          color: "#fff", border: "none", borderRadius: 10, padding: "14px",
          fontSize: 14, fontWeight: 700, cursor: ready && !loading ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Processing card payment…" : `Pay £${amount.toFixed(2)} by card`}
      </button>
      <p style={{ fontSize: 11, color: "#777", lineHeight: 1.5, marginTop: 8 }}>
        Your card details are securely handled by Square.
      </p>
    </div>
  );
}
