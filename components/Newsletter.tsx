const STORE_COLOR = "#16a34a";

export default function Newsletter() {
  return (
    <section
      style={{
        background: "#f0f7f1",
        borderTop: "1px solid #e0efe3",
        borderBottom: "1px solid #e0efe3",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 20,
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 4 }}>
            Join the ZAYVI community
          </div>
          <div style={{ fontSize: 14, color: "#555" }}>
            Get 10% off your first order and exclusive early access.
          </div>
        </div>
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: "flex", gap: 8, flex: 1, maxWidth: 380 }}
        >
          <input
            type="email"
            placeholder="Enter your email"
            style={{
              flex: 1,
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={
              {
                background: STORE_COLOR,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }
            }
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  );
}
