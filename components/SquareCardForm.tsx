"use client";

import { useState } from "react";

/**
 * Square Web Payments SDK card form.
 * Requires NEXT_PUBLIC_SQUARE_APP_ID and a location ID.
 * Loads the Square script dynamically so the rest of the site still works without keys.
 */

type Props = {
  amount: number; // in GBP, e.g. 34.50
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
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID; // optional public location if you prefer

  // Load Square.js once
  const loadSquare = async () => {
    if (window.Square) return window.Square;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://sandbox.web.squarecdn.com/v1/square.js"; // change to production URL later
      script.onload = () => resolve(window.Square);
      script.onerror = () => reject(new Error("Failed to load Square"));
      document.body.appendChild(script);
    });
  };

  const initCard = async () => {
    if (!appId) {
      onError("Square Application ID is missing");
      return;
    }
    try {
      const Square = await loadSquare();
      const payments = Square.payments(appId, locationId || "sandbox");
      const cardInstance = await payments.card();
      await cardInstance.attach("#square-card-container");
      setCard(cardInstance);
      setReady(true);
    } catch (e) {
      console.error(e);
      onError("Could not initialise Square card form");
    }
  };

  // Auto-init when component mounts
  useState(() => {
    // slight delay so the container exists
    const t = setTimeout(initCard, 100);
    return () => clearTimeout(t);
  });

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
