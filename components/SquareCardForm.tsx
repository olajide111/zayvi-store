"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  amount: number;
  items: { id: number; qty: number }[];
  onSuccess: () => void;
  onError: (msg: string) => void;
};

type BuyerDetails = {
  givenName: string;
  familyName: string;
  email: string;
  addressLine: string;
  city: string;
  postcode: string;
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
  const [buyer, setBuyer] = useState<BuyerDetails>({
    givenName: "", familyName: "", email: "", addressLine: "", city: "", postcode: "",
  });
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  const environment = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

  useEffect(() => {
    if (!appId || !locationId) return;
    let cancelled = false;
    let cardInstance: any;

    const init = async () => {
      try {
        if (!window.Square) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-square-web-payments="true"]');
            if (existing) {
              if (window.Square) resolve();
              else {
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(new Error("Failed to load Square")), { once: true });
              }
              return;
            }
            const script = document.createElement("script");
            script.dataset.squareWebPayments = "true";
            script.src = environment === "production"
              ? "https://web.squarecdn.com/v1/square.js"
              : "https://sandbox.web.squarecdn.com/v1/square.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Square"));
            document.head.appendChild(script);
          });
        }
        if (cancelled || !window.Square) return;
        const payments = window.Square.payments(appId, locationId);
        cardInstance = await payments.card();
        await cardInstance.attach("#square-card-container");
        if (!cancelled) {
          setCard(cardInstance);
          setReady(true);
        }
      } catch (error) {
        console.error("Square card initialisation failed", error);
        if (!cancelled) onErrorRef.current("Card payments are temporarily unavailable. Please try PayPal or try again later.");
      }
    };

    init();
    return () => {
      cancelled = true;
      if (cardInstance?.destroy) cardInstance.destroy().catch(() => undefined);
    };
  }, [appId, locationId, environment]);

  const updateBuyer = (field: keyof BuyerDetails, value: string) => {
    setBuyer((current) => ({ ...current, [field]: value }));
  };

  const handlePay = async () => {
    if (!card || loading || amount <= 0) return;
    const email = buyer.email.trim();
    if (!buyer.givenName.trim() || !buyer.familyName.trim() || !/^\S+@\S+\.\S+$/.test(email) ||
        !buyer.addressLine.trim() || !buyer.city.trim() || !buyer.postcode.trim()) {
      onError("Enter your name, valid email and billing address before paying by card.");
      return;
    }

    setLoading(true);
    try {
      const verificationDetails = {
        amount: amount.toFixed(2),
        billingContact: {
          givenName: buyer.givenName.trim(),
          familyName: buyer.familyName.trim(),
          email,
          addressLines: [buyer.addressLine.trim()],
          city: buyer.city.trim(),
          postalCode: buyer.postcode.trim(),
          countryCode: "GB",
        },
        currencyCode: "GBP",
        intent: "CHARGE",
        customerInitiated: true,
        sellerKeyedIn: false,
      };
      const result = await card.tokenize(verificationDetails);
      if (result.status !== "OK" || !result.token) {
        throw new Error(result.errors?.[0]?.message || "Please check your card details and try again.");
      }

      const res = await fetch("/api/square", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: result.token,
          items,
          idempotencyKey: crypto.randomUUID(),
          buyer: {
            givenName: buyer.givenName.trim(),
            familyName: buyer.familyName.trim(),
            email,
            addressLine: buyer.addressLine.trim(),
            city: buyer.city.trim(),
            postcode: buyer.postcode.trim(),
            country: "GB",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.redirect) throw new Error(data.error || "Card payment failed. Please try again.");
      onSuccess();
      window.location.assign(data.redirect);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Card payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    width: "100%", boxSizing: "border-box" as const, padding: "10px 11px",
    border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, marginBottom: 8,
  };

  if (!appId || !locationId) {
    return (
      <p style={{ fontSize: 12, color: "#777", lineHeight: 1.5, marginTop: 12 }}>
        Card payments will appear here once the matching Square application and location are configured.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Pay securely by card</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="First name" autoComplete="given-name" placeholder="First name" value={buyer.givenName} onChange={(e) => updateBuyer("givenName", e.target.value)} style={fieldStyle} />
        <input aria-label="Last name" autoComplete="family-name" placeholder="Last name" value={buyer.familyName} onChange={(e) => updateBuyer("familyName", e.target.value)} style={fieldStyle} />
      </div>
      <input aria-label="Email address" type="email" autoComplete="email" placeholder="Email address" value={buyer.email} onChange={(e) => updateBuyer("email", e.target.value)} style={fieldStyle} />
      <input aria-label="Billing address" autoComplete="address-line1" placeholder="Billing address" value={buyer.addressLine} onChange={(e) => updateBuyer("addressLine", e.target.value)} style={fieldStyle} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Town or city" autoComplete="address-level2" placeholder="Town / city" value={buyer.city} onChange={(e) => updateBuyer("city", e.target.value)} style={fieldStyle} />
        <input aria-label="Postcode" autoComplete="postal-code" placeholder="Postcode" value={buyer.postcode} onChange={(e) => updateBuyer("postcode", e.target.value)} style={fieldStyle} />
      </div>
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
        Your card details are securely handled by Square. Billing details are used for payment verification.
      </p>
    </div>
  );
}
