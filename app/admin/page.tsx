"use client";

import { useRef, useState } from "react";

type UploadResult = { key: string };

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      setAuthenticated(true);
      setPassword("");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Choose an image first.");
      return;
    }
    setBusy(true);
    setMessage("");
    setUploaded(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/product-images", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setUploaded({ key: data.key });
      setMessage("Image uploaded successfully.");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setUploaded(null);
    setMessage("You have signed out.");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f7f5", color: "#151515", padding: "40px 18px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
          <a href="/" style={{ color: "#111", textDecoration: "none", fontSize: 25, fontWeight: 900, letterSpacing: "-1px" }}>ZAYVI<span style={{ color: "#16a34a" }}>.</span></a>
          {authenticated && <button onClick={signOut} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 9, padding: "10px 15px", cursor: "pointer" }}>Sign out</button>}
        </header>

        {!authenticated ? (
          <section style={{ background: "#fff", border: "1px solid #e8e8e5", borderRadius: 18, padding: 28, maxWidth: 440, margin: "8vh auto" }}>
            <p style={{ color: "#16a34a", fontSize: 12, fontWeight: 800, letterSpacing: 1.4 }}>ZAYVI STORE</p>
            <h1 style={{ fontSize: 28, margin: "8px 0" }}>Admin sign in</h1>
            <p style={{ color: "#666", lineHeight: 1.6, fontSize: 14, marginBottom: 24 }}>Sign in to manage product images and store assets.</p>
            <form onSubmit={signIn}>
              <label htmlFor="admin-password" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Admin password</label>
              <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d9d9d5", borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16 }} />
              <button disabled={busy} type="submit" style={{ width: "100%", border: 0, borderRadius: 10, background: "#16a34a", color: "#fff", padding: 14, fontWeight: 800, fontSize: 15, cursor: busy ? "wait" : "pointer" }}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
            {message && <p role="status" style={{ color: "#b42318", fontSize: 13, marginTop: 14 }}>{message}</p>}
          </section>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <p style={{ color: "#16a34a", fontSize: 12, fontWeight: 800, letterSpacing: 1.4 }}>STORE MANAGEMENT</p>
              <h1 style={{ fontSize: 32, margin: "8px 0" }}>Product images</h1>
              <p style={{ color: "#666", lineHeight: 1.6 }}>Upload product photography to your private AWS storage. Accepted formats: JPEG, PNG, WebP and AVIF. Maximum size: 5 MB.</p>
            </div>
            <section style={{ background: "#fff", border: "1px solid #e8e8e5", borderRadius: 18, padding: 26 }}>
              <form onSubmit={uploadImage}>
                <label htmlFor="product-image" style={{ display: "block", fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Choose product image</label>
                <input ref={fileRef} id="product-image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "block", width: "100%", marginBottom: 18 }} />
                {file && <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                <button disabled={busy || !file} type="submit" style={{ border: 0, borderRadius: 10, background: busy || !file ? "#9ca3af" : "#16a34a", color: "#fff", padding: "13px 20px", fontWeight: 800, fontSize: 14, cursor: busy || !file ? "not-allowed" : "pointer" }}>{busy ? "Uploading…" : "Upload image"}</button>
              </form>
              {message && <p role="status" style={{ color: uploaded ? "#16803d" : "#555", fontSize: 14, marginTop: 18 }}>{message}</p>}
              {uploaded && <div style={{ marginTop: 14, padding: 14, background: "#f0fdf4", borderRadius: 10, overflowWrap: "anywhere" }}><p style={{ fontSize: 12, fontWeight: 800, margin: "0 0 6px" }}>S3 object key</p><code style={{ fontSize: 12 }}>{uploaded.key}</code></div>}
            </section>
            <p style={{ color: "#888", fontSize: 12, lineHeight: 1.6, marginTop: 18 }}>This upload area is a first admin tool. Uploaded files remain private in AWS S3; a product image delivery method will be configured separately.</p>
          </>
        )}
      </div>
    </main>
  );
}
