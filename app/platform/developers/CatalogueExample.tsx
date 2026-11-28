"use client";

import { useState, type FormEvent } from "react";
import styles from "../platform.module.css";

export default function CatalogueExample() {
  const [market, setMarket] = useState("GB");
  const [response, setResponse] = useState<{ status: number; json: unknown } | null>(null);
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const endpoint = "/api/sandbox/v1/catalogue/products?market=" + market;

  async function runExample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setResponse(null);
    setUnavailable(false);

    try {
      const result = await fetch(endpoint, { headers: { Accept: "application/json" } });
      setResponse({ status: result.status, json: await result.json() });
    } catch {
      setUnavailable(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className={styles.exampleForm} onSubmit={runExample}>
        <label htmlFor="example-market">Market</label>
        <select id="example-market" value={market} disabled={pending} onChange={(event) => {
          setMarket(event.currentTarget.value);
          setResponse(null);
          setUnavailable(false);
        }}>
          <option value="GB">United Kingdom (GBP)</option>
          <option value="NG">Nigeria (NGN)</option>
        </select>
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "Running request…" : "Run sandbox request"}
        </button>
      </form>
      <p className={styles.requestLine}><code>GET {endpoint}</code></p>
      <div aria-live="polite">
        {unavailable && <p role="status">The sandbox did not return JSON. Try the request again.</p>}
        {response && (
          <>
            <p className={styles.requestLine}><code>HTTP {response.status}</code></p>
            <pre className={styles.code} aria-label="Sandbox catalogue response">
              <code>{JSON.stringify(response.json, null, 2)}</code>
            </pre>
          </>
        )}
      </div>
    </>
  );
}
