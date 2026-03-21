export default function Success() {
    return (
      <div style={{ minHeight: "100vh", background: "#f8f8f6",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", marginBottom: 10 }}>
            Order Confirmed!
          </h1>
          <p style={{ fontSize: 16, color: "#777", marginBottom: 8 }}>
            Thank you for your purchase. You will receive a confirmation email shortly.
          </p>
          <p style={{ fontSize: 14, color: "#aaa", marginBottom: 32 }}>
            Your order will be dispatched within 1-2 business days.
          </p>
          <a href="/" style={{ background: "#111", color: "#fff",
            padding: "14px 32px", borderRadius: 10, textDecoration: "none",
            fontSize: 14, fontWeight: 700 }}>
            Continue Shopping
          </a>
        </div>
      </div>
    );
  }