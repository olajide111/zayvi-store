import type { Metadata } from "next";
import SandboxExample from "./SandboxExample";
import styles from "../platform.module.css";

export const metadata: Metadata = {
  title: "Developer preview | Zayvi",
  description: "Explore draft Zayvi partner API catalogue and order event examples.",
};

export default function DevelopersPage() {
  return (
    <div className={styles.innerPage}>
      <p className={styles.kicker}>Developer preview</p>
      <h1>Plan your Zayvi integration<span>.</span></h1>
      <p className={styles.lead}>Try both the sample catalogue and paid-order event endpoints. Live partner data and credentials are pending.</p>
      <div className={styles.actions}>
        <a className={styles.primary} href="mailto:hello@zayvi.store?subject=Zayvi%20developer%20pilot">Enquire about pilot access</a>
      </div>
      <section className={styles.innerSection}>
        <h2>Catalogue example</h2>
        <p>Choose a market to call the sandbox and see the JSON response. The endpoint serves sample products and requires no partner key. Prices use integer minor currency units.</p>
        <SandboxExample example="catalogue" />
        <details className={styles.integrationDetails}>
          <summary>Test from a terminal</summary>
          <p>Set the base URL to the origin serving this page. The market parameter takes GB or NG. Missing, repeated or unsupported market values return HTTP 400 with the error code INVALID_MARKET.</p>
          <pre className={styles.code}><code>{'curl -i "$ZAYVI_SANDBOX_ORIGIN/api/sandbox/v1/catalogue/products?market=NG"'}</code></pre>
        </details>
      </section>
      <section className={styles.innerSection}>
        <h2>Order event example</h2>
        <p>Fetch a sample event with a stable ID, market, currency and paid amount. Repeating a request for the same market returns the same event ID so you can practise deduplication in your integration.</p>
        <SandboxExample example="order-paid" />
        <p>This endpoint returns a sample payload on request. Webhook delivery is pending.</p>
      </section>
    </div>
  );
}
