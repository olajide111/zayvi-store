"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  isDeliveryQuote, type DeliveryAddress, type DeliveryQuote,
  type DraftOrderDetails, type DraftOrderReceipt,
} from "@/lib/delivery";

const STORE_COLOR = "#215241";
const emptyAddress: DeliveryAddress = { line1: "", line2: "", city: "", region: "", postcode: "" };
const fieldClass = "mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-[#9eafa3] px-3 text-base focus-visible:outline-2 focus-visible:outline-[#215241]";

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
  onCreateDraftOrder: (details: DraftOrderDetails) => Promise<DraftOrderReceipt>;
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
  const [address, setAddress] = useState(emptyAddress);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<DraftOrderReceipt | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [quoteResult, setQuoteResult] = useState<{ market: string; revision: number; quote: DeliveryQuote | null } | null>(null);
  const [revision, setRevision] = useState(0);
  const quote = quoteResult?.market === marketCode && quoteResult.revision === revision ? quoteResult.quote : null;
  const quoteFailed = quoteResult?.market === marketCode && quoteResult.revision === revision && !quoteResult.quote;
  const hasItems = cart.length > 0;
  const isNigeria = marketCode === "NG";

  useEffect(() => {
    if (!open || !hasItems) return;
    const abort = new AbortController();
    fetch(`/api/storefront/delivery?market=${marketCode}`, { signal: abort.signal, cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() : null)
      .then((data) => {
        if (!abort.signal.aborted) setQuoteResult({ market: marketCode, revision, quote: isDeliveryQuote(data, marketCode) ? data : null });
      })
      .catch(() => {
        if (!abort.signal.aborted) setQuoteResult({ market: marketCode, revision, quote: null });
      });
    return () => abort.abort();
  }, [open, hasItems, marketCode, revision]);

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || (!quote && !quoteFailed) || pricingState !== "verified") return;
    setSaving(true);
    setDraftMessage("");
    try {
      const result = await onCreateDraftOrder({
        customerName,
        customerEmail,
        phone: phone.trim() || undefined,
        ...(quote ? { deliveryAddress: address, shippingMinor: quote.shippingMinor } : {}),
      });
      setReceipt(result);
      setCustomerName("");
      setCustomerEmail("");
      setPhone("");
      setAddress(emptyAddress);
    } catch (error) {
      setDraftMessage(error instanceof Error ? error.message : "Unable to create draft order.");
      setRevision((current) => current + 1);
    } finally {
      setSaving(false);
    }
  }

  const browserSubtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const currency = marketCode === "NG" ? "NGN" : "GBP";
  const formatMoney = (value: number, code = currency) =>
    new Intl.NumberFormat(code === "NGN" ? "en-NG" : "en-GB", {
      style: "currency",
      currency: code,
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
        inert={!open}
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
            aria-label="Close cart"
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
          {!hasItems && receipt ? (
            <section aria-labelledby="draft-receipt" className="space-y-3 rounded-xl border border-[#dfe6e1] bg-[#f5f8f5] p-4">
              <h2 id="draft-receipt" className="font-semibold">Draft order saved</h2>
              <p className="break-words text-sm">{receipt.orderNumber}</p>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-2"><dt>Subtotal</dt><dd>{formatMoney(receipt.subtotal, receipt.currency)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Preview delivery</dt><dd>{formatMoney(receipt.shippingTotal, receipt.currency)}</dd></div>
                <div className="flex justify-between gap-2 font-semibold"><dt>Draft total</dt><dd>{formatMoney(receipt.total, receipt.currency)}</dd></div>
              </dl>
              <p className="text-xs text-[#52635b]">Unpaid Preview order. Nothing will be shipped.</p>
            </section>
          ) : !hasItems ? (
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
                        <button disabled={saving} onClick={() => onQty(item.id, item.selectedColor, item.selectedSize, -1)} style={{ width: 28, height: 28, background: "none", border: "none", cursor: "pointer" }}>−</button>
                        <span style={{ width: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{item.qty}</span>
                        <button disabled={saving} onClick={() => onQty(item.id, item.selectedColor, item.selectedSize, 1)} style={{ width: 28, height: 28, background: "none", border: "none", cursor: "pointer" }}>+</button>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{formatMoney(item.price * item.qty)}</div>
                        <button disabled={saving} onClick={() => onRemove(item.id, item.selectedColor, item.selectedSize)} style={{ fontSize: 10, color: "#ccc", background: "none", border: "none", cursor: "pointer" }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {hasItems && (
            <section aria-labelledby="cart-delivery" className="mt-2 space-y-4 border-t border-[#e4e9e5] pt-4 pb-4">
              <h2 id="cart-delivery" className="text-base font-semibold">Delivery details</h2>
              <p className="text-sm text-[#52635b]">Use a sample address for this unpaid Preview order.</p>
              <dl className="space-y-2 rounded-xl bg-[#f3f7f2] p-3 text-sm">
                <div className="flex justify-between gap-2"><dt>Subtotal</dt><dd>{formatMoney(sub)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Preview delivery</dt><dd>{quote ? formatMoney(quote.shippingMinor / 100) : "—"}</dd></div>
                <div className="flex justify-between gap-2 border-t border-[#dfe6e1] pt-2 font-semibold"><dt>Estimated draft total</dt><dd>{quote ? formatMoney(sub + quote.shippingMinor / 100) : "—"}</dd></div>
              </dl>
              {quoteFailed && (
                <div className="text-sm">
                  <p role="status">Preview delivery is unavailable. You can still save a draft without an address or delivery fee.</p>
                  <button type="button" className="mt-2 min-h-11 text-[#215241] underline" onClick={() => setRevision((current) => current + 1)}>Check again</button>
                </div>
              )}
              {!quote && !quoteFailed ? <p role="status" className="text-sm">Checking delivery setup…</p> : (
                <form onSubmit={saveDraft} className="space-y-3 text-sm">
                  <label className="block">Full name
                    <input className={fieldClass} value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" maxLength={120} required />
                  </label>
                  <label className="block">Email address
                    <input className={fieldClass} value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} type="email" autoComplete="email" maxLength={254} required />
                  </label>
                  <label className="block">Phone (optional)
                    <input className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" maxLength={32} />
                  </label>
                  {quote && <fieldset className="min-w-0 space-y-3">
                    <legend className="font-semibold">{isNigeria ? "Nigeria" : "United Kingdom"} address</legend>
                    {([
                      ["line1", "Street address", "address-line1", true],
                      ["line2", "Flat, unit or landmark (optional)", "address-line2", false],
                      ["city", "Town or city", "address-level2", true],
                      ["region", isNigeria ? "State or FCT" : "County (optional)", "address-level1", isNigeria],
                      ["postcode", isNigeria ? "Postcode (optional)" : "Postcode", "postal-code", !isNigeria],
                    ] as const).map(([key, label, autocomplete, required]) => (
                      <label key={key} className="block">{label}
                        <input
                          className={fieldClass}
                          value={address[key]}
                          onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))}
                          autoComplete={"shipping " + autocomplete}
                          inputMode={isNigeria && key === "postcode" ? "numeric" : undefined}
                          maxLength={120}
                          required={required}
                        />
                      </label>
                    ))}
                  </fieldset>}
                  <button type="submit" disabled={saving || pricingState !== "verified"} className="min-h-11 w-full rounded-lg bg-[#215241] px-3 font-semibold text-white disabled:opacity-50">
                    {saving ? "Saving draft…" : quote ? "Save Preview draft order" : "Save draft without delivery"}
                  </button>
                  {pricingState !== "verified" && <p role="status" className="text-[#52635b]">{pricingState === "error" ? "Cart prices are temporarily unavailable." : "Checking current cart prices…"}</p>}
                </form>
              )}
              {draftMessage && <p role="alert" className="text-sm text-red-800">{draftMessage}</p>}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
