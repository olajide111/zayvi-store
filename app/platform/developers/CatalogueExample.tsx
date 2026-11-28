"use client";

import { useState } from "react";
import styles from "../platform.module.css";

const examples = {
  GB: { id: "prod_demo_001", name: "Weekender bag", market: "GB", currency: "GBP", priceMinor: 2400 },
  NG: { id: "prod_demo_002", name: "Canvas carryall", market: "NG", currency: "NGN", priceMinor: 1800000 },
};

export default function CatalogueExample() {
  const [market, setMarket] = useState<keyof typeof examples>("GB");
  const [shownMarket, setShownMarket] = useState<keyof typeof examples>("GB");
  const product = examples[shownMarket];

  return (
    <>
      <form className={styles.exampleForm} onSubmit={(event) => {
        event.preventDefault();
        setShownMarket(market);
      }}>
        <label htmlFor="example-market">Market</label>
        <select id="example-market" value={market} onChange={(event) => {
          setMarket(event.currentTarget.value === "NG" ? "NG" : "GB");
        }}>
          <option value="GB">United Kingdom (GBP)</option>
          <option value="NG">Nigeria (NGN)</option>
        </select>
        <button className={styles.primary} type="submit">Run local example</button>
      </form>
      <div aria-live="polite">
        <p className={styles.requestLine}><code>GET /v1/catalogue/products?market={shownMarket}</code></p>
        <pre className={styles.code} aria-label="Sample catalogue response"><code>{JSON.stringify({ products: [product] }, null, 2)}</code></pre>
      </div>
    </>
  );
}
