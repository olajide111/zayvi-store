"use client";

import { PRODUCTS } from "@/lib/products";

const STORE_COLOR = "#16a34a";

export type CartItem = {
  id: number;
  name: string;
  emoji: string;
  price: number;
  qty: number;
  selectedColor?: string;
};

type Props = {
  cart: CartItem[];
  open: boolean;
  onClose: () => void;
  onQty: (id: number, color: string | undefined, d: number) => void;
  onRemove: (id: number, color: string | undefined) => void;
  onCheckout: () => void;
};

export default function CartDrawer({ cart, open, onClose, onQty, onRemove, onCheckout }: Props) {
  const sub = cart.reduce((a, i) => a + i.price * i.qty, 0);
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
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Your Cart</div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
              {cnt} item{cnt !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid #eee",
              background: "#fafafa",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "12px 24px", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: 12, color: STORE_COLOR, fontWeight: 700 }}>
            🎉 FREE worldwide shipping on every order
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
              const product = PRODUCTS.find((p) => p.id === item.id);
              return (
                <div
                  key={`${item.id}-${item.selectedColor}`}
                  style={{
                    display: "flex",
                    gap: 14,
                    paddingBottom: 16,
                    marginBottom: 16,
                    borderBottom: "1px solid #f5f5f5",
                  }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      background: "#f9f9f9",
                      borderRadius: 10,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {product?.image ? (
                      <img
                        src={product.image}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 28,
                        }}
                      >
                        {item.emoji}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.name}
                    </div>
                    {item.selectedColor && (
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                        {item.selectedColor}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 8,
                      }}
                    >
                      <div style={{ display: "flex", border: "1px solid #e5e5e5", borderRadius: 6 }}>
                        <button
                          onClick={() => onQty(item.id, item.selectedColor, -1)}
                          style={{
                            width: 28,
                            height: 28,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            width: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {item.qty}
                        </span>
                        <button
                          onClick={() => onQty(item.id, item.selectedColor, 1)}
                          style={{
                            width: 28,
                            height: 28,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>
                          £{(item.price * item.qty).toFixed(2)}
                        </div>
                        <button
                          onClick={() => onRemove(item.id, item.selectedColor)}
                          style={
                            {
                              fontSize: 10,
                              color: "#ccc",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                            }
                          }
                        >
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 16,
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              <span>Subtotal</span>
              <span>£{sub.toFixed(2)}</span>
            </div>
            <button
              onClick={onCheckout}
              style={{
                width: "100%",
                background: STORE_COLOR,
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "16px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Checkout with PayPal
            </button>
          </div>
        )}
      </div>
    </>
  );
}
