"use client";

import { useState, useEffect } from "react";

/**
 * Square Web Payments SDK card form.
 * Requires NEXT_PUBLIC_SQUARE_APP_ID.
 * Loads the Square script dynamically so the rest of the site still works without keys.
 */

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

  useEffect(() => {
    if (!appId) return;

    let cancelled = false;

    const init = async () => {
      try {
        if (!window.Square) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            // Sandbox for testing – change to https://web.squarecdn.com/v1/square.js for production
            script.src = "https://sandbox.web.squarecdn.com/v1/square.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Square"));
            document.body.appendChild(script);
          });
        }

        if (cancelled) return;

        const payments = window.Square.payments(appId, "sandbox");
        const cardInstance = await payments.card();
        await cardInstance.attach("#square-card-container");

        if (!cancelled) {
          setCard(cardInstance);
          setReady(true);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) onError("Could not initialise Square card form");
      }
    };

    const t = setTimeout(init, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [appId]);

  const handlePay = async () => {
    if (!card) return;
    setLoading(true);
    try {
      const result = await card.tokenize();
      if (result.status === "OK") {
        const res = await fetch("/api/square", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: result.token,
            items,
          }),
        });
        const data = await res.json();
        if (data.success) {
          onSuccess();
          if (data.redirect) window.location.href = data.redirect;
        } else {
          onError(data.error || "Payment failed");
        }
      } else {
        onError(result.errors?.[0]?.message || "Card validation failed");
      }
    } catch (e) {
      onError("Payment error — please try again");
    } finally {
      setLoading(false);
    }
  };

  if (!appId) {
    return (
      <div style={{ padding: 16, background: "#fef3c7", borderRadius: 10, fontSize: 13, color: "#92400e" }}>
        Square is not configured. Add <code>NEXT_PUBLIC_SQUARE_APP_ID</code> to <code>.env.local</code>.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div
        id="square-card-container"
        style={{
          minHeight: 90,
          padding: 12,
          border: "1px solid #e5e5e5",
          borderRadius: 10,
          background: "#fafafa",
        }}
      />
      <button
        onClick={handlePay}
        disabled={!ready || loading}
        style={{
          width: "100%",
          marginTop: 12,
          background: loading ? "#999" : "#000",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "14px",
          fontSize: 14,
          fontWeight: 700,
          cursor: ready && !loading ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Processing…" : `Pay £${amount.toFixed(2)} with Card`}
      </button>
    </div>
  );
}
