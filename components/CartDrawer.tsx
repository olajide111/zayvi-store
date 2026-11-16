"use client";

import { useState } from "react";

const STORE_COLOR = "#16a34a";

export type CartItem = {
  id: string;
  image: string;
  name: string;
  emoji: string;
  price: number;
  qty: number;
  selectedColor?: string;
  selectedSize?: string;
};

type Props = {
  cart: CartItem[];
  open: boolean;
  onClose: () => void;
  onQty: (id: string, color: string | undefined, size: string | undefined, d: number) => void;
  onRemove: (id: string, color: string | undefined, size: string | undefined) => void;
  onCreateDraftOrder: (details: {
    customerName: string;
    customerEmail: string;
    phone?: string;
  }) => Promise<{ orderNumber: string; orderId: string }>;
  verifiedSubtotal: number | null;
  pricingState: "idle" | "checking" | "verified" | "error";
  marketCode: "GB" | "NG";
};

export default function CartDrawer({
  cart,
  open,
  onClose,
  onQty,
  onRemove,
  onCreateDraftOrder,
  verifiedSubtotal,
  pricingState,
  marketCode,
}: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftMessage, setDraftMessage] = useState("");

  const browserSubtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const currency = marketCode === "NG" ? "NGN" : "GBP";
  const formatMoney = (value: number) =>
    new Intl.NumberFormat(marketCode === "NG" ? "en-NG" : "en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: marketCode === "NG" ? 0 : 2,
    }).format(value);
  const sub = verifiedSubtotal ?? browserSubtotal;
  const cnt = cart.reduce((a, i) => a + i.qty, 0);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.45)",
          zIndex: 1100,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "all" : "none",
          transition: "opacity .3s",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          maxWidth: "100%",
          background: "#fff",
          zIndex: 1101,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform .35s cubic-bezier(.4,0,.2,1)",
          boxShadow: "-8px 0 40px rgba(0,0,0,.14)",
        }}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Your Cart</div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
              {cnt} item{cnt !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #eee", background: "#fafafa", cursor: "pointer", fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "12px 24px", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: 12, color: STORE_COLOR, fontWeight: 700 }}>
            Preview {marketCode === "NG" ? "Nigeria · NGN" : "United Kingdom · GBP"} — checkout is not enabled yet
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: 14, color: "#aaa" }}>Your cart is empty</div>
            </div>
          ) : (
            cart.map((item) => {
              return (
                <div
                  key={`${item.id}-${item.selectedColor || ""}-${item.selectedSize || ""}`}
                  style={{ display: "flex", gap: 14, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid #f5f5f5" }}
                >
                  <div style={{ width: 68, height: 68, background: "#f9f9f9", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                    {item.image ? (
                      <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                        {item.emoji}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </div>
                    {(item.selectedColor || item.selectedSize) && (
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                        {[item.selectedColor, item.selectedSize].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      <div style={{ display: "flex", border: "1px solid #e5e5e5", borderRadius: 6 }}>
                        <button onClick={() => onQty(item.id, item.selectedColor, item.selectedSize, -1)} style={{ width: 28, height: 28, background: "none", border: "none", cursor: "pointer" }}>−</button>
                        <span style={{ width: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{item.qty}</span>
                        <button onClick={() => onQty(item.id, item.selectedColor, item.selectedSize, 1)} style={{ width: 28, height: 28, background: "none", border: "none", cursor: "pointer" }}>+</button>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{formatMoney(item.price * item.qty)}</div>
                        <button onClick={() => onRemove(item.id, item.selectedColor, item.selectedSize)} style={{ fontSize: 10, color: "#ccc", background: "none", border: "none", cursor: "pointer" }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: 24, borderTop: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 16, fontWeight: 800 }}>
              <span>Subtotal</span>
              <span>{formatMoney(sub)}</span>
            </div>

            <div style={{ marginBottom: 10, textAlign: "center", fontSize: 11, fontWeight: 700, color: pricingState === "verified" ? "#15803d" : pricingState === "error" ? "#b45309" : "#777" }}>
              {pricingState === "verified"
                ? "Prices verified from PostgreSQL"
                : pricingState === "checking"
                  ? "Checking current prices..."
                  : pricingState === "error"
                    ? "Price verification temporarily unavailable"
                    : "Preview cart"}
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
                style={{ width: "100%", border: "1px solid #ddd", borderRadius: 10, padding: "11px 12px", fontSize: 13 }}
              />
              <input
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                placeholder="Email address"
                type="email"
                autoComplete="email"
                style={{ width: "100%", border: "1px solid #ddd", borderRadius: 10, padding: "11px 12px", fontSize: 13 }}
              />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone (optional)"
                autoComplete="tel"
                style={{ width: "100%", border: "1px solid #ddd", borderRadius: 10, padding: "11px 12px", fontSize: 13 }}
              />
              <button
                type="button"
                disabled={draftState === "saving" || pricingState !== "verified"}
                onClick={async () => {
                  setDraftMessage("");
                  setDraftState("saving");
                  try {
                    const result = await onCreateDraftOrder({
                      customerName,
                      customerEmail,
                      phone: phone || undefined,
                    });
                    setDraftState("saved");
                    setDraftMessage(
                      `Draft order ${result.orderNumber} created. Order UUID: ${result.orderId}`
                    );
                  } catch (error) {
                    setDraftState("error");
                    setDraftMessage(error instanceof Error ? error.message : "Unable to create draft order.");
                  }
                }}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 13,
                  fontWeight: 800,
                  background: pricingState === "verified" ? "#17251e" : "#d8d8d3",
                  color: "#fff",
                  cursor: draftState === "saving" || pricingState !== "verified" ? "not-allowed" : "pointer",
                }}
              >
                {draftState === "saving" ? "Saving draft order..." : "Save Preview draft order"}
              </button>
              {draftMessage && (
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    textAlign: "center",
                    color: draftState === "saved" ? "#15803d" : "#b45309",
                  }}
                >
                  {draftMessage}
                </div>
              )}
            </div>
            <p style={{ fontSize: 12, color: "#777", lineHeight: 1.6, textAlign: "center", marginTop: 12 }}>
              This only saves an unpaid Preview draft. No payment is taken and no fulfilment begins.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
