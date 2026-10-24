"use client";

import { useState, useEffect, useRef } from "react";
import { PRODUCTS, lineKey, variantLabel } from "@/lib/products";

const STORE_NAME = "ZAYVI";
const STORE_COLOR = "#16a34a";



const CATS = ["All","Travel","Outdoors","Pets","Fitness","Home","Beauty","Health","Accessories"];

const PAGES: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: "Last updated: March 2025\n\nZAYVI is committed to protecting your privacy. This policy explains how we collect, use and protect your personal information.\n\nWhat we collect:\n• Name, email and shipping address to fulfil your order\n• Payment information processed securely by PayPal — we never store your card details\n• Browsing data to improve your shopping experience\n\nHow we use your data:\n• To process and deliver your orders\n• To send order confirmations and tracking updates\n• To send marketing emails if you opt in — you can unsubscribe at any time\n• To improve our website and product selection\n\nYour rights:\n• You can request a copy of your data at any time\n• You can ask us to delete your data\n• You can opt out of marketing at any time\n\nWe do not sell your data to third parties.\n\nFor questions: hello@zayvi.store",
  },
  returns: {
    title: "Returns Policy",
    body: "We want you to love every purchase. If you are not completely satisfied we make returns simple.\n\nReturn window: 30 days from delivery\n\nHow to return:\n1. Email hello@zayvi.store within 30 days of delivery\n2. Include your order number and reason for return\n3. We will send you return instructions within 24 hours\n4. Once we receive your return, refund is processed within 5 business days\n\nConditions:\n• Items must be unused and in original packaging\n• Personalised items cannot be returned unless faulty\n• Sale items are eligible for exchange or store credit\n\nDamaged items:\nIf your item arrives damaged, email us a photo within 7 days. We will send a replacement or full refund immediately — no need to return the item.\n\nRefund method:\nRefunds are returned to your original payment method.\n\nContact: hello@zayvi.store",
  },
  shipping: {
    title: "Shipping Information",
    body: "We ship worldwide from trusted suppliers. All orders include a tracking number sent by email once dispatched.\n\nDelivery Times:\n• United Kingdom: 7-14 business days\n• United States: 8-14 business days\n• Europe: 10-16 business days\n• Australia and Canada: 10-18 business days\n• Rest of World: 12-21 business days\n\nShipping Costs:\n• FREE worldwide shipping on every order — no minimum spend\n\nOrder Tracking:\nYou will receive a tracking link by email once your order is dispatched. You can use this to track your order in real time.\n\nImportant:\n• Orders are processed within 1-3 business days\n• Delivery times are estimates and may vary during busy periods\n• International orders may be subject to local customs duties\n\nQuestions about your order? Email hello@zayvi.store with your order number.",
  },
  tracking: {
    title: "Track Your Order",
    body: "Track your ZAYVI order in 3 easy steps:\n\n1. Check your email\nOnce your order is dispatched you will receive a shipping confirmation email with your tracking number and a direct link to track your package.\n\n2. Use your tracking link\nClick the tracking link in your email to see real-time updates on your order location and estimated delivery date.\n\n3. Still need help?\nIf you have not received a tracking email within 5 business days of ordering, contact us at hello@zayvi.store with your order number and we will look into it immediately.\n\nPlease note:\n• Tracking information can take 24-48 hours to update after dispatch\n• International orders may show limited tracking updates depending on destination country\n\nContact: hello@zayvi.store",
  },
  contact: {
    title: "Contact Us",
    body: "We are here to help and aim to respond to every message within 24 hours.\n\nEmail: hello@zayvi.store\nBusiness hours: Monday to Friday, 9am to 6pm GMT\n\nFor the fastest response please include:\n• Your order number (if applicable)\n• A clear description of your question or issue\n• Photos if your item arrived damaged\n\nWhat we can help with:\n• Order status and tracking\n• Returns and refunds\n• Product questions\n• General enquiries\n\nWe do not have a phone line at this time but our email support team is fast and friendly. We promise to get back to you within 24 hours on business days.",
  },
  faqs: {
    title: "Frequently Asked Questions",
    body: "ORDERS AND DELIVERY\n\nHow long does delivery take?\nMost orders arrive in 7-14 business days for UK customers. International orders take 10-21 business days.\n\nCan I track my order?\nYes. You will receive a tracking link by email once your order is dispatched. Allow 24-48 hours for tracking to update.\n\nCan I change or cancel my order?\nContact us at hello@zayvi.store as soon as possible. We can make changes before dispatch but cannot cancel orders that have already shipped.\n\nRETURNS AND REFUNDS\n\nWhat is your returns policy?\nWe offer 30-day returns on all items. Email hello@zayvi.store with your order number to start a return.\n\nWhat if my item arrives damaged?\nEmail us a photo within 7 days and we will send a replacement or full refund immediately.\n\nHow long do refunds take?\nRefunds are processed within 5 business days of receiving your return.\n\nPAYMENTS\n\nWhich payment methods do you accept?\nPayPal, or debit and credit cards through PayPal checkout.\n\nIs it safe to pay on ZAYVI?\nYes. Payments are processed by PayPal. We never see or store your card details.\n\nDo you offer free shipping?\nYes — FREE worldwide shipping on every single order. No minimum spend required.",
  },
  about: {
    title: "About ZAYVI",
    body: "ZAYVI is an AI-powered ecommerce store built to discover and deliver the world's most exciting trending products directly to your door.\n\nOur story:\nWe started ZAYVI with a simple idea — use technology to find the products people actually want before they even know they want them. Our system scans thousands of products every day, scoring each one on demand, trend velocity, quality and value. Only the very best make it to our store.\n\nWhat makes us different:\n• AI-powered product discovery — we find trending products before they go mainstream\n• Rigorous quality screening — every product is reviewed before listing\n• Worldwide delivery\n• 30-day returns on unused items\n\nOur promise:\nEvery product on ZAYVI is selected because we believe it offers genuine value. If you are ever unhappy with a purchase we will make it right.\n\nFree worldwide shipping on every order.\n30-day returns on unused items in original packaging.\n\nThank you for shopping with us.\n\nThe ZAYVI Team\nhello@zayvi.store",
  },
  giftcards: {
    title: "Gift Cards",
    body: "Give the gift of choice with a ZAYVI gift card.\n\nComing Soon:\nWe are currently setting up our gift card system. Digital gift cards will be available very soon.\n\nIn the meantime:\nIf you would like to purchase a gift for someone, you can place an order and ship directly to their address.\n\nFor gift card enquiries contact: hello@zayvi.store\n\nEmail hello@zayvi.store to be told when gift cards launch.",
  },
  affiliate: {
    title: "Affiliate Programme",
    body: "Earn money by sharing ZAYVI products with your audience.\n\nHow it works:\n1. Apply to join our affiliate programme\n2. Get your unique referral link\n3. Share products on social media, YouTube, TikTok or your blog\n4. Earn commission on every sale you generate\n\nCommission rates:\n• Standard: 8% per sale\n• Top affiliates: up to 15% per sale\n• Payments made monthly via PayPal or bank transfer\n\nWho can apply:\n• Content creators and influencers\n• Bloggers and website owners\n• Social media accounts with engaged followings\n• Anyone passionate about great products\n\nTo apply:\nEmail hello@zayvi.store with:\n• Your name\n• Your social media handles or website\n• Your audience size and niche\n\nWe review all applications within 3 business days.",
  },
  careers: {
    title: "Careers",
    body: "Join the ZAYVI team.\n\nWe are a fast-growing AI-powered ecommerce company always looking for talented people to join us.\n\nCurrent opportunities:\nWe do not have any open roles at this time but we are always interested in hearing from exceptional people.\n\nAreas we hire in:\n• Technology and engineering\n• Product and design\n• Marketing and content\n• Customer experience\n• Operations and logistics\n\nOur culture:\n• Remote-first team\n• Fast-moving and entrepreneurial\n• Data-driven decision making\n• Passionate about great products\n\nTo register your interest:\nSend your CV and a short note about yourself to hello@zayvi.store with the subject line CAREERS.\n\nWe will keep your details on file and reach out when a suitable role opens.",
  },
  press: {
    title: "Press",
    body: "ZAYVI in the media.\n\nAbout ZAYVI:\nZAYVI is an AI-powered ecommerce store that uses machine learning to discover and curate trending products from around the world. We ship worldwide and offer free shipping on every order.\n\nFounded: 2025\nHeadquarters: United Kingdom\nWebsite: zayvi.store\n\nKey facts:\n• AI-powered product discovery system\n• 36 products across 8 categories\n• Free worldwide shipping\n• 30-day returns on unused items\n• Checkout through PayPal\n\nFor press enquiries, interviews, partnerships or media assets:\n\nEmail: hello@zayvi.store\nSubject line: PRESS\n\nWe aim to respond to all media enquiries within 24 hours.",
  },
};

function ColorDot({ color, active, onClick }: {
  color: { name: string; hex: string }; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={color.name}
      style={{ width: 22, height: 22, borderRadius: "50%", background: color.hex,
        border: "none", cursor: "pointer", flexShrink: 0,
        outline: active ? "2px solid #111" : "2px solid transparent",
        outlineOffset: 2, transition: "outline .15s" }} />
  );
}

function PageModal({ pageKey, onClose }: { pageKey: string; onClose: () => void }) {
  const p = PAGES[pageKey];
  if (!p) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0,
        background: "rgba(0,0,0,.55)", zIndex: 1400, backdropFilter: "blur(4px)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1401,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, width: "100%",
          maxWidth: 580, maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,.3)" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0f0",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>{p.title}</div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%",
              border: "1px solid #eee", background: "#fafafa", cursor: "pointer",
              fontSize: 16, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#777" }}>✕</button>
          </div>
          <div style={{ padding: 24 }}>
            {p.body.split("\n\n").map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: "#555", lineHeight: 1.9,
                marginBottom: 16, whiteSpace: "pre-line" }}>{para}</p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

interface CartItem {
  id: number; name: string; emoji: string;
  price: number; qty: number; color?: string; size?: string;
}

type AddFn = (p: typeof PRODUCTS[0], qty: number, color: string | undefined, size: string | undefined) => void;

function CartDrawer({ cart, open, onClose, onQty, onRemove }: {
  cart: CartItem[]; open: boolean; onClose: () => void;
  onQty: (key: string, d: number) => void;
  onRemove: (key: string) => void;
}) {
  const sub  = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const cnt  = cart.reduce((a, i) => a + i.qty, 0);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0,
        background: "rgba(0,0,0,.45)", zIndex: 1100,
        opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none",
        transition: "opacity .3s" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
        background: "#fff", zIndex: 1101, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .35s cubic-bezier(.4,0,.2,1)",
        boxShadow: "-8px 0 40px rgba(0,0,0,.14)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0f0",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Your Cart</div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
              {cnt} item{cnt !== 1 ? "s" : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%",
            border: "1px solid #eee", background: "#fafafa", cursor: "pointer",
            fontSize: 16, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#777" }}>✕</button>
        </div>
        <div style={{ padding: "12px 24px", background: "#fafafa",
          borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
              🎉 FREE worldwide shipping on every order!
            </div>
          <div style={{ height: 4, background: "#dcfce7", borderRadius: 2, marginTop: 8 }}>
            <div style={{ width: "100%", height: "100%",
              background: "#16a34a", borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {cart.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                <div style={{ fontSize: 14, color: "#aaa" }}>Your cart is empty</div>
              </div>
            : cart.map(item => (
              <div key={lineKey(item)}
                style={{ display: "flex", gap: 14, paddingBottom: 16, marginBottom: 16,
                  borderBottom: "1px solid #f5f5f5" }}>
                <div style={{ width: 68, height: 68, background: "#f9f9f9", borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, flexShrink: 0 }}>{item.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </div>
                  {variantLabel(item) && (
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                      {variantLabel(item)}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center",
                    justifyContent: "space-between", marginTop: 8 }}>
                    <div style={{ display: "flex", border: "1px solid #e5e5e5",
                      borderRadius: 6, overflow: "hidden" }}>
                      <button onClick={() => onQty(lineKey(item), -1)}
                        style={{ width: 28, height: 28, background: "none", border: "none",
                          cursor: "pointer", fontSize: 16, color: "#888" }}>−</button>
                      <span style={{ width: 28, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 13, fontWeight: 600,
                        color: "#111" }}>{item.qty}</span>
                      <button onClick={() => onQty(lineKey(item), 1)}
                        style={{ width: 28, height: 28, background: "none", border: "none",
                          cursor: "pointer", fontSize: 16, color: "#888" }}>+</button>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>
                        £{(item.price * item.qty).toFixed(2)}
                      </div>
                      <button onClick={() => onRemove(lineKey(item))}
                        style={{ fontSize: 10, color: "#ccc", background: "none",
                          border: "none", cursor: "pointer", marginTop: 2 }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        {cart.length > 0 && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "#888" }}>Subtotal</span>
              <span style={{ fontSize: 13, color: "#555" }}>£{sub.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "#888" }}>Shipping</span>
              <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>
                FREE
              </span>
            </div>
            {/* Stripe button hidden until VMSS resolved
            <button
              onClick={async () => {
                const res = await fetch('/api/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: cart }),
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
              style={{ width: "100%", background: "#111", color: "#fff",
                border: "none", borderRadius: 10, padding: "14px", cursor: "pointer",
                fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
              Checkout · £{sub.toFixed(2)}
            </button>
            */}
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/paypal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: cart.map(i => ({ id: i.id, qty: i.qty, color: i.color, size: i.size })) }),
                  });
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                  else alert(data.error || "PayPal error. Please try again.");
                } catch {
                  alert("PayPal error. Please try again.");
                }
              }}
              style={{ width: "100%", background: "#FFC439", color: "#003087",
                border: "none", borderRadius: 10, padding: "14px", cursor: "pointer",
                fontSize: 15, fontWeight: 800, marginBottom: 10,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🅿️</span> Pay with PayPal · £{sub.toFixed(2)}
            </button>
            <div style={{ textAlign: "center", fontSize: 11, color: "#bbb" }}>
              PayPal · Debit Card · Credit Card · Secure Checkout
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function QuickView({ product, open, onClose, onAdd }: {
  product: typeof PRODUCTS[0] | null; open: boolean;
  onClose: () => void;
  onAdd: AddFn;
}) {
  // Remounted per product (see key on <QuickView>), so choices start fresh each time.
  const [qty,   setQty]   = useState(1);
  const [col,   setCol]   = useState(0);
  const [sz,    setSz]    = useState(0);
  const [tab,   setTab]   = useState("desc");
  const [added, setAdded] = useState(false);
  if (!product) return null;
  const handleAdd = () => {
    onAdd(product, qty, product.colors[col]?.name, product.sizes[sz]);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0,
        background: "rgba(0,0,0,.55)", zIndex: 1200,
        opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none",
        transition: "opacity .3s" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1201,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, pointerEvents: open ? "all" : "none" }}>
        <div style={{ background: "#fff", borderRadius: 20, width: "100%",
          maxWidth: 860, maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,.25)",
          transform: open ? "scale(1)" : "scale(.96)",
          opacity: open ? 1 : 0, transition: "all .3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ background: "#f9f9f9", borderRadius: "20px 0 0 20px",
              padding: 32, display: "flex", flexDirection: "column",
              gap: 16, minHeight: 500 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 110 }}>
                {product.image
                  ? <img src={product.image} alt={product.name}
                      style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 12 }} />
                  : product.emoji
                }
              </div>
            </div>
            <div style={{ padding: 32, display: "flex", flexDirection: "column",
              gap: 14, position: "relative" }}>
              <button onClick={onClose} style={{ position: "absolute", top: 16,
                right: 16, width: 32, height: 32, borderRadius: "50%",
                border: "1px solid #eee", background: "#fafafa", cursor: "pointer",
                fontSize: 14, display: "flex", alignItems: "center",
                justifyContent: "center", color: "#999" }}>✕</button>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111",
                lineHeight: 1.2, margin: 0 }}>{product.name}</h2>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: "#111" }}>£{product.price}</span>
              </div>
              {product.colors.length > 1 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888",
                    letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    Colour — <span style={{ color: "#111", textTransform: "none",
                      fontWeight: 600 }}>{product.colors[col].name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {product.colors.map((c, i) => (
                      <ColorDot key={i} color={c} active={col === i} onClick={() => setCol(i)} />
                    ))}
                  </div>
                </div>
              )}
              {product.sizes.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888",
                    letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Size</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {product.sizes.map((s, i) => (
                      <button key={i} onClick={() => setSz(i)}
                        style={{ padding: "6px 14px",
                          border: `1px solid ${sz === i ? "#111" : "#e5e5e5"}`,
                          borderRadius: 6, background: sz === i ? "#111" : "#fff",
                          color: sz === i ? "#fff" : "#555",
                          fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888",
                  letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Qty</div>
                <div style={{ display: "inline-flex", alignItems: "center",
                  border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}
                    style={{ width: 38, height: 38, background: "#fafafa",
                      border: "none", cursor: "pointer", fontSize: 18, color: "#555" }}>−</button>
                  <span style={{ width: 42, textAlign: "center",
                    fontSize: 15, fontWeight: 700, color: "#111" }}>{qty}</span>
                  <button onClick={() => setQty(q => Math.min(20, q + 1))}
                    style={{ width: 38, height: 38, background: "#fafafa",
                      border: "none", cursor: "pointer", fontSize: 18, color: "#555" }}>+</button>
                </div>
              </div>
              <button onClick={handleAdd}
                style={{ background: added ? "#16a34a" : "#111", color: "#fff",
                  border: "none", borderRadius: 10, padding: "14px",
                  cursor: "pointer", fontSize: 14, fontWeight: 800,
                  transition: "background .3s" }}>
                {added ? "Added!" : `Add to Cart — £${(product.price * qty).toFixed(2)}`}
              </button>
              <div style={{ fontSize: 11, color: "#bbb", textAlign: "center" }}>
                Free shipping · 30-day returns · Secure checkout
              </div>
              <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 14 }}>
                <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", marginBottom: 12 }}>
                  {[["desc","Description"],["feat","Features"],["rev","Reviews"]].map(([k,l]) => (
                    <button key={k} onClick={() => setTab(k)}
                      style={{ padding: "7px 14px", border: "none", background: "none",
                        cursor: "pointer", fontSize: 12,
                        fontWeight: tab === k ? 700 : 400,
                        color: tab === k ? "#111" : "#aaa",
                        borderBottom: `2px solid ${tab === k ? "#111" : "transparent"}`,
                        marginBottom: -1 }}>
                      {l}
                    </button>
                  ))}
                </div>
                {tab === "desc" && <p style={{ fontSize: 13, color: "#666", lineHeight: 1.8, margin: 0 }}>{product.longDesc}</p>}
                {tab === "feat" && (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {product.features.map((f, i) => (
                      <li key={i} style={{ display: "flex", gap: 8, fontSize: 13,
                        color: "#555", padding: "4px 0", alignItems: "center" }}>
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                )}
                {tab === "rev" && (
                  <p style={{ fontSize: 13, color: "#888", lineHeight: 1.8, margin: 0 }}>
                    No reviews yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ product, onView, onAdd }: {
  product: typeof PRODUCTS[0];
  onView: (p: typeof PRODUCTS[0]) => void;
  onAdd: AddFn;
}) {
  const [hov,  setHov]  = useState(false);
  const [col,  setCol]  = useState(0);
  const [wish, setWish] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: "#fff", borderRadius: 16, overflow: "hidden", cursor: "pointer",
        boxShadow: hov ? "0 16px 48px rgba(0,0,0,.13)" : "0 2px 8px rgba(0,0,0,.05)",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        transition: "all .2s ease" }}>
      <div onClick={() => onView(product)}
        style={{ background: "#f9f9f9", height: 210, display: "flex",
          alignItems: "center", justifyContent: "center", position: "relative" }}>
        {product.image
          ? <img src={product.image} alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover",
                transform: hov ? "scale(1.08)" : "scale(1)", transition: "transform .3s" }} />
          : <div style={{ fontSize: 84, transform: hov ? "scale(1.08)" : "scale(1)",
              transition: "transform .3s" }}>{product.emoji}</div>
        }
        <button onClick={e => { e.stopPropagation(); setWish(w => !w); }}
          style={{ position: "absolute", bottom: 12, right: 12, width: 32, height: 32,
            borderRadius: "50%", background: "#fff", border: "none", cursor: "pointer",
            fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,.1)",
            transform: hov ? "scale(1)" : "scale(0)", transition: "transform .2s",
            color: wish ? "#dc2626" : "#ccc" }}>
          {wish ? "♥" : "♡"}
        </button>
        {hov && (
          <div style={{ position: "absolute", inset: 0, display: "flex",
            alignItems: "flex-end", justifyContent: "center", paddingBottom: 14 }}>
            <button onClick={e => { e.stopPropagation(); onView(product); }}
              style={{ background: "rgba(255,255,255,.95)", border: "none",
                borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.12)", color: "#111" }}>
              Quick View
            </button>
          </div>
        )}
      </div>
      <div style={{ padding: "16px 16px 20px" }}>
        <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 1,
          textTransform: "uppercase", marginBottom: 4 }}>{product.category}</div>
        <div onClick={() => onView(product)}
          style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 6, lineHeight: 1.3 }}>
          {product.name}
        </div>
        {product.colors.length > 1 && (
          <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
            {product.colors.map((c, i) => (
              <ColorDot key={i} color={c} active={col === i} onClick={() => setCol(i)} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#111" }}>£{product.price}</span>
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              // Sized products need a size choice first, so open the product view instead.
              if (product.sizes.length > 0) onView(product);
              else onAdd(product, 1, product.colors[col]?.name, undefined);
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#333")}
            onMouseLeave={e => (e.currentTarget.style.background = "#111")}
            style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8,
              padding: "9px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700,
              transition: "background .15s" }}>
            {product.sizes.length > 0 ? "Choose size" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [cart,    setCart]    = useState<CartItem[]>([]);
  const [cartOpen,setCartOpen]= useState(false);
  const [qv,      setQv]      = useState<typeof PRODUCTS[0] | null>(null);
  const [cat,     setCat]     = useState("All");
  const [sort,    setSort]    = useState("featured");
  const [search,  setSearch]  = useState("");
  const [searchOn,setSearchOn]= useState(false);
  const [megaOn,  setMegaOn]  = useState(false);
  const [scrolled,setScrolled]= useState(false);
  const [toast,   setToast]   = useState<string | null>(null);
  const [page,    setPage]    = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    if (searchOn) setTimeout(() => searchRef.current?.focus(), 80);
  }, [searchOn]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const scrollToGrid = () => document.getElementById("grid")?.scrollIntoView({ behavior: "smooth" });

  const addToCart: AddFn = (product, qty, color, size) => {
    const key = lineKey({ id: product.id, color, size });
    setCart(prev => {
      const ex = prev.find(i => lineKey(i) === key);
      if (ex) return prev.map(i => lineKey(i) === key ? { ...i, qty: Math.min(20, i.qty + qty) } : i);
      return [...prev, { id: product.id, name: product.name, emoji: product.emoji,
        price: product.price, qty: Math.min(20, qty), color, size }];
    });
    showToast(`✓ ${product.name} added to cart`);
    setCartOpen(true);
  };

  const removeFromCart = (key: string) =>
    setCart(p => p.filter(i => lineKey(i) !== key));

  const updateQty = (key: string, delta: number) =>
    setCart(p => p.map(i =>
      lineKey(i) === key ? { ...i, qty: Math.min(20, Math.max(1, i.qty + delta)) } : i));

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);

  const filtered = PRODUCTS
    .filter(p => cat === "All" || p.category === cat)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "price-asc"  ? a.price - b.price :
      sort === "price-desc" ? b.price - a.price : 0);

  const marquee = "✦ FREE worldwide shipping on every order   ✦ 30-day returns on unused items   ✦ Secure checkout with PayPal   ";

  const footerCols = [
    { title: "Shop", items: [
      { label: "All Products", fn: () => { setCat("All"); setSort("featured"); scrollToGrid(); } },
      { label: "Lowest Price", fn: () => { setSort("price-asc"); setCat("All"); scrollToGrid(); } },
      { label: "Gift Cards",   fn: () => setPage("giftcards") },
    ]},
    { title: "Help", items: [
      { label: "Track Order",  fn: () => setPage("tracking") },
      { label: "Returns",      fn: () => setPage("returns") },
      { label: "Shipping",     fn: () => setPage("shipping") },
      { label: "Contact",      fn: () => setPage("contact") },
      { label: "FAQs",         fn: () => setPage("faqs") },
    ]},
    { title: "Company", items: [
      { label: "About",        fn: () => setPage("about") },
      { label: "Careers",      fn: () => setPage("careers") },
      { label: "Press",        fn: () => setPage("press") },
      { label: "Affiliate",    fn: () => setPage("affiliate") },
      { label: "Privacy",      fn: () => setPage("privacy") },
    ]},
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6",
      fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" }}>
      <style>{`
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes toastUp{from{opacity:0;transform:translateY(12px) translateX(-50%)}to{opacity:1;transform:translateY(0) translateX(-50%)}}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#f8f8f6}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}
      `}</style>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%",
          background: "#111", color: "#fff", padding: "11px 22px", borderRadius: 40,
          fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
          boxShadow: "0 8px 28px rgba(0,0,0,.2)", animation: "toastUp .3s ease",
          transform: "translateX(-50%)" }}>
          {toast}
        </div>
      )}

      <div style={{ background: "#111", color: "#fff", height: 34,
        overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", animation: "marquee 24s linear infinite", whiteSpace: "nowrap" }}>
          {[marquee, marquee].map((t, i) => (
            <span key={i} style={{ fontSize: 11, letterSpacing: 0.6, padding: "0 32px", opacity: 0.85 }}>{t}</span>
          ))}
        </div>
      </div>

      <nav style={{ position: "sticky", top: 0, zIndex: 900, background: "#fff",
        borderBottom: "1px solid #efefef",
        boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,.07)" : "none",
        transition: "box-shadow .2s" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px",
          height: 62, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 20 }}>
          <div onClick={() => { setCat("All"); setSort("featured"); setSearch(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            style={{ fontSize: 24, fontWeight: 900, color: "#111", letterSpacing: -0.5, cursor: "pointer", flexShrink: 0 }}>
            {STORE_NAME}<span style={{ color: STORE_COLOR }}>.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "center" }}
            onMouseLeave={() => setMegaOn(false)}>
            <div style={{ position: "relative" }} onMouseEnter={() => setMegaOn(true)}>
              <button onClick={() => { setCat("All"); scrollToGrid(); setMegaOn(false); }}
                style={{ padding: "8px 14px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#444",
                  borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                Shop All <span style={{ fontSize: 9 }}>▾</span>
              </button>
              {megaOn && (
                <div style={{ position: "absolute", top: "100%", left: "50%",
                  transform: "translateX(-50%)", background: "#fff", borderRadius: 16,
                  boxShadow: "0 20px 60px rgba(0,0,0,.14)", border: "1px solid #f0f0f0",
                  padding: 24, display: "grid", gridTemplateColumns: "180px 180px",
                  gap: 24, zIndex: 200, marginTop: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa",
                      letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Categories</div>
                    {CATS.filter(c => c !== "All").map(c => (
                      <button key={c} onClick={() => { setCat(c); setMegaOn(false); scrollToGrid(); }}
                        style={{ display: "block", width: "100%", textAlign: "left",
                          padding: "5px 0", background: "none", border: "none",
                          cursor: "pointer", fontSize: 13, color: "#555", fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#111")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#555")}>{c}</button>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa",
                      letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Collections</div>
                    {[
                      { label: "All Products", fn: () => { setSort("featured"); setCat("All"); setMegaOn(false); scrollToGrid(); } },
                      { label: "Lowest Price", fn: () => { setSort("price-asc"); setCat("All"); setMegaOn(false); scrollToGrid(); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.fn}
                        style={{ display: "block", width: "100%", textAlign: "left",
                          padding: "5px 0", background: "none", border: "none",
                          cursor: "pointer", fontSize: 13, color: "#555", fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#111")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#555")}>{item.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {[
              { label: "All Products", fn: () => { setSort("featured"); setCat("All"); scrollToGrid(); } },
            ].map(item => (
              <button key={item.label} onClick={item.fn}
                style={{ padding: "8px 14px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#444", borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.color = "#111")}
                onMouseLeave={e => (e.currentTarget.style.color = "#444")}>{item.label}</button>
            ))}
            <button onClick={() => { setSort("price-asc"); setCat("All"); scrollToGrid(); }}
              style={{ padding: "8px 14px", background: "none", border: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#444", borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#111")}
              onMouseLeave={e => (e.currentTarget.style.color = "#444")}>Lowest Price</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setSearchOn(true)}
              style={{ width: 36, height: 36, borderRadius: 8, border: "none",
                background: "none", cursor: "pointer", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}>🔍</button>
            <button onClick={() => setCartOpen(true)}
              onMouseEnter={e => (e.currentTarget.style.background = "#333")}
              onMouseLeave={e => (e.currentTarget.style.background = "#111")}
              style={{ display: "flex", alignItems: "center", gap: 8,
                background: "#111", color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                transition: "background .15s" }}>
              🛒 Cart
              {cartCount > 0 && (
                <span style={{ background: STORE_COLOR, borderRadius: 20,
                  padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {searchOn && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,.97)",
          zIndex: 1300, display: "flex", flexDirection: "column",
          alignItems: "center", paddingTop: 80 }}>
          <button onClick={() => { setSearchOn(false); setSearch(""); }}
            style={{ position: "absolute", top: 20, right: 24, width: 38, height: 38,
              borderRadius: "50%", border: "1px solid #eee", background: "#fff",
              cursor: "pointer", fontSize: 17, color: "#888" }}>✕</button>
          <div style={{ fontSize: 11, color: "#aaa", letterSpacing: 2,
            textTransform: "uppercase", marginBottom: 20 }}>Search</div>
          <div style={{ position: "relative", width: "100%", maxWidth: 560, padding: "0 20px" }}>
            <input ref={searchRef} value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setSearchOn(false); scrollToGrid(); } }}
              placeholder="What are you looking for?"
              style={{ width: "100%", border: "none", borderBottom: "2px solid #111",
                padding: "14px 14px 14px 46px", fontSize: 22, fontWeight: 600,
                outline: "none", background: "transparent", color: "#111" }} />
            <span style={{ position: "absolute", left: 34, top: "50%",
              transform: "translateY(-50%)", fontSize: 18, color: "#ccc" }}>🔍</span>
          </div>
          {search && (
            <div style={{ marginTop: 28, display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 10, maxWidth: 640, width: "100%", padding: "0 20px" }}>
              {PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
                .slice(0, 4).map(p => (
                <div key={p.id} onClick={() => { setSearchOn(false); setQv(p); }}
                  style={{ background: "#fff", borderRadius: 12, padding: 12, cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,.07)", display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>
                    {p.image
                      ? <img src={p.image} alt={p.name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} />
                      : p.emoji}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>£{p.price}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <section style={{ background: "#fff", padding: "72px 28px 56px",
        overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: -100, right: -60, width: 440, height: 440,
          background: `radial-gradient(circle, ${STORE_COLOR}12 0%, transparent 70%)`,
          borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1280, margin: "0 auto",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 20, padding: "6px 14px", marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%",
                background: STORE_COLOR, display: "inline-block" }} />
              <span style={{ fontSize: 11, color: STORE_COLOR, fontWeight: 700, letterSpacing: 0.8 }}>
                FREE WORLDWIDE SHIPPING
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(34px, 4vw, 56px)", fontWeight: 900, color: "#111",
              lineHeight: 1.08, letterSpacing: -1, marginBottom: 18 }}>
              Everyday products,<br />
              <span style={{ color: STORE_COLOR }}>delivered</span><br />to your door.
            </h1>
            <p style={{ fontSize: 16, color: "#777", lineHeight: 1.8, marginBottom: 28, maxWidth: 400 }}>
              A small range of home, travel, beauty and fitness products. Free worldwide delivery. 30-day returns.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={scrollToGrid}
                style={{ background: "#111", color: "#fff", border: "none",
                  borderRadius: 10, padding: "13px 26px", cursor: "pointer",
                  fontSize: 14, fontWeight: 800 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#333")}
                onMouseLeave={e => (e.currentTarget.style.background = "#111")}>
                Shop Now →
              </button>
              <button onClick={() => { setSort("price-asc"); scrollToGrid(); }}
                style={{ background: "transparent", color: "#111", border: "1px solid #ddd",
                  borderRadius: 10, padding: "13px 26px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#999")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#ddd")}>
                Lowest Price
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {PRODUCTS.slice(0, 4).map(p => (
              <div key={p.id} onClick={() => setQv(p)}
                style={{ background: "#f9f9f9", borderRadius: 16, padding: 18,
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 8, transition: "transform .2s, box-shadow .2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 28px rgba(0,0,0,.09)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
                {p.image
                  ? <img src={p.image} alt={p.name}
                      style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: "16px 16px 0 0" }} />
                  : <div style={{ fontSize: 46, padding: 18 }}>{p.emoji}</div>
                }
                <div style={{ padding: "4px 12px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111", lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#111", marginTop: 4 }}>£{p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0", padding: "20px 28px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 8, overflowX: "auto" }}>
          {CATS.map(c => (
            <button key={c} onClick={() => { setCat(c); scrollToGrid(); }}
              style={{ padding: "9px 20px", borderRadius: 40, flexShrink: 0,
                cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .15s",
                border: "1px solid", borderColor: cat === c ? "#111" : "#e5e5e5",
                background: cat === c ? "#111" : "#fff", color: cat === c ? "#fff" : "#666" }}>
              {c}
            </button>
          ))}
        </div>
      </section>

      <section id="grid" style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: "#111", letterSpacing: -0.5 }}>
              {cat === "All" ? "All Products" : cat}
            </h2>
            <div style={{ fontSize: 13, color: "#aaa", marginTop: 3 }}>
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 14px",
              fontSize: 13, color: "#555", outline: "none", background: "#fff", cursor: "pointer" }}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, color: "#aaa", fontWeight: 700 }}>No products found</div>
              <button onClick={() => { setSearch(""); setCat("All"); }}
                style={{ marginTop: 16, background: "#111", color: "#fff", border: "none",
                  borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                  fontSize: 13, fontWeight: 700 }}>Clear filters</button>
            </div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
              {filtered.map(p => <Card key={p.id} product={p} onView={setQv} onAdd={addToCart} />)}
            </div>
        }
      </section>

      <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0",
        borderBottom: "1px solid #f0f0f0", padding: "40px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 28 }}>
          {[["🔒","Secure Payments","Checkout through PayPal (card or PayPal balance)."],
            ["🚚","Free Worldwide Shipping","Free on every order. No minimum."],
            ["↩️","30-Day Returns","Return unused items within 30 days of delivery."]
          ].map(([icon,title,desc]) => (
            <div key={title as string} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "#111", padding: "64px 28px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: STORE_COLOR, letterSpacing: 2,
            textTransform: "uppercase", marginBottom: 14 }}>STAY IN THE LOOP</div>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: "#fff",
            marginBottom: 10, letterSpacing: -0.5 }}>Get early access to new drops</h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24, lineHeight: 1.7 }}>
            Hear about new products and offers first.
          </p>
          <p style={{ fontSize: 14, color: "#aaa", lineHeight: 1.7 }}>
            Email <span style={{ color: "#fff", fontWeight: 700, userSelect: "all" }}>hello@zayvi.store</span> and ask to join the list.
          </p>
        </div>
      </section>

      <footer style={{ background: "#0a0a0a", padding: "56px 28px 28px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 44, marginBottom: 44 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -0.5, marginBottom: 14 }}>
                {STORE_NAME}<span style={{ color: STORE_COLOR }}>.</span>
              </div>
              <p style={{ fontSize: 13, color: "#555", lineHeight: 1.8, maxWidth: 240 }}>
                AI-powered ecommerce. Trending products delivered worldwide. No subscriptions, ever.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                {["TikTok","Instagram","Twitter"].map(s => (
                  <button key={s} style={{ background: "#1a1a1a", border: "1px solid #222",
                    borderRadius: 6, padding: "5px 12px", color: "#666", cursor: "pointer", fontSize: 11 }}>{s}</button>
                ))}
              </div>
            </div>
            {footerCols.map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#555",
                  letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>{col.title}</div>
                {col.items.map(item => (
                  <div key={item.label} onClick={item.fn}
                    style={{ fontSize: 13, color: "#444", marginBottom: 10, cursor: "pointer" }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.color = "#fff")}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.color = "#444")}>
                    {item.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 22,
            display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#333" }}>2025 {STORE_NAME}. Zero subscriptions.</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["PayPal","Visa","Mastercard"].map(p => (
                <span key={p} style={{ fontSize: 10, color: "#444", background: "#111",
                  border: "1px solid #222", padding: "4px 10px", borderRadius: 4 }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {page && <PageModal pageKey={page} onClose={() => setPage(null)} />}
      <CartDrawer cart={cart} open={cartOpen}
        onClose={() => setCartOpen(false)} onQty={updateQty} onRemove={removeFromCart} />
      <QuickView key={qv?.id ?? "none"} product={qv} open={!!qv}
        onClose={() => setQv(null)} onAdd={addToCart} />
    </div>
  );
}