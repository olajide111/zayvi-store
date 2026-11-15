"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PRODUCTS } from "@/lib/products";

type CartItem = {
  id: number;
  name: string;
  price: number;
  qty: number;
  selectedColor?: string;
  selectedSize?: string;
};

type OrderResult = {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: string;
};

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [countryCode, setCountryCode] = useState("GB");
  const [form, setForm] = useState({
    name: "",
    email: "",
    line1: "",
    line2: "",
    city: "",
    postcode: "",
  });
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState<"paypal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("zayvi-cart");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setCart(parsed);
    } catch {
      setCart([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );

  const currency = countryCode === "NG" ? "NGN" : "GBP";
  const nigeriaSelected = countryCode === "NG";

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const createOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || cart.length === 0) return;

    setError(null);

    if (nigeriaSelected) {
      setError(
        "Kredal Pay is being integrated for Nigeria, but ZAYVI has not enabled server-side NGN catalogue pricing yet. We will not invent an exchange rate or take a test payment for a real order."
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email },
          shippingAddress: {
            name: form.name,
            line1: form.line1,
            line2: form.line2,
            city: form.city,
            postcode: form.postcode,
            countryCode,
          },
          currency,
          items: cart.map((item) => ({
            id: item.id,
            qty: item.qty,
            selectedColor: item.selectedColor,
            selectedSize: item.selectedSize,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create your order.");

      const created: OrderResult = data;
      setOrder(created);
      sessionStorage.setItem("zayvi-checkout-order", JSON.stringify(created));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your order.");
    } finally {
      setLoading(false);
    }
  };

  const startPayPal = async () => {
    if (!order || paying) return;
    setPaying("paypal");
    setError(null);

    try {
      const response = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || "PayPal checkout is unavailable.");
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start PayPal.");
      setPaying(null);
    }
  };

  if (!hydrated) {
    return <main style={{ padding: 40, fontFamily: "system-ui" }}>Loading checkout…</main>;
  }

  if (cart.length === 0) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui", background: "#f8f8f6" }}>
        <section style={{ textAlign: "center", maxWidth: 460 }}>
          <h1>Your basket is empty</h1>
          <p style={{ color: "#666" }}>Add an item before starting checkout.</p>
          <Link href="/" style={{ color: "#111", fontWeight: 700 }}>Return to ZAYVI</Link>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8f8f6", padding: "32px 20px 64px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#555", textDecoration: "none", fontSize: 13 }}>← Back to store</Link>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, .8fr)", gap: 28, marginTop: 20 }}>
          <section style={{ background: "#fff", borderRadius: 18, padding: 28 }}>
            <h1 style={{ margin: 0, fontSize: 28 }}>Checkout</h1>
            <p style={{ color: "#666", lineHeight: 1.6 }}>Create your ZAYVI order first, then choose a secure payment method.</p>

            {!order ? (
              <form onSubmit={createOrder}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Delivery country</label>
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", marginBottom: 18 }}>
                  <option value="GB">United Kingdom — GBP</option>
                  <option value="NG">Nigeria — NGN / Kredal Pay</option>
                </select>

                {[
                  ["name", "Full name", "name"],
                  ["email", "Email", "email"],
                  ["line1", "Address line 1", "address-line1"],
                  ["line2", "Address line 2 (optional)", "address-line2"],
                  ["city", "Town / city", "address-level2"],
                  ["postcode", countryCode === "GB" ? "Postcode" : "Postal code (if applicable)", "postal-code"],
                ].map(([field, label, autoComplete]) => (
                  <div key={field} style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</label>
                    <input
                      type={field === "email" ? "email" : "text"}
                      required={!["line2"].includes(field)}
                      value={form[field as keyof typeof form]}
                      onChange={(e) => update(field as keyof typeof form, e.target.value)}
                      autoComplete={autoComplete}
                      style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  </div>
                ))}

                {nigeriaSelected && (
                  <div style={{ margin: "18px 0", padding: 14, background: "#f6f7f5", borderRadius: 12, fontSize: 13, lineHeight: 1.6 }}>
                    <strong>Kredal Pay integration:</strong> the platform connection is being built in test mode. Live NGN checkout stays disabled until ZAYVI has explicit server-side NGN pricing and Kredal live credentials.
                  </div>
                )}

                {error && <p role="alert" style={{ color: "#b42318", fontSize: 13, lineHeight: 1.6 }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: "100%", border: 0, borderRadius: 12, padding: 14, background: "#111", color: "#fff", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}
                >
                  {loading ? "Creating secure order…" : nigeriaSelected ? "Review Kredal availability" : "Create order & continue"}
                </button>
              </form>
            ) : (
              <div>
                <div style={{ padding: 16, borderRadius: 12, background: "#f6f7f5", margin: "18px 0" }}>
                  <div style={{ fontSize: 12, color: "#666" }}>ZAYVI ORDER</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{order.orderNumber}</div>
                  <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>Awaiting payment · £{(order.amountMinor / 100).toFixed(2)}</div>
                </div>

                <h2 style={{ fontSize: 18 }}>Payment</h2>
                <button
                  type="button"
                  onClick={startPayPal}
                  disabled={!!paying}
                  style={{ width: "100%", border: 0, borderRadius: 12, padding: 14, background: "#0070ba", color: "#fff", fontWeight: 800, cursor: paying ? "wait" : "pointer" }}
                >
                  {paying === "paypal" ? "Connecting to PayPal…" : "Continue with PayPal"}
                </button>

                <p style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
                  Square card payment will be moved onto this order-first checkout next. Your order is not marked paid until the payment provider is verified server-side.
                </p>

                {error && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{error}</p>}
              </div>
            )}
          </section>

          <aside style={{ background: "#fff", borderRadius: 18, padding: 24, alignSelf: "start" }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Order summary</h2>
            {cart.map((item) => {
              const product = PRODUCTS.find((p) => p.id === item.id);
              return (
                <div key={item.id + "-" + (item.selectedColor || "")} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #eee", fontSize: 13 }}>
                  <div>
                    <strong>{product?.name || item.name}</strong>
                    <div style={{ color: "#777", marginTop: 4 }}>Qty {item.qty}{item.selectedColor ? " · " + item.selectedColor : ""}</div>
                  </div>
                  <strong>£{(item.price * item.qty).toFixed(2)}</strong>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 18, fontSize: 17 }}>
              <strong>Total</strong>
              <strong>{countryCode === "GB" ? "£" + total.toFixed(2) : "NGN pricing pending"}</strong>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
