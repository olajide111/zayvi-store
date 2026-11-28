import type { Metadata } from "next";
import CatalogueExample from "./CatalogueExample";
import styles from "../platform.module.css";

export const metadata: Metadata = {
  title: "Developer preview | Zayvi",
  description: "Explore draft Zayvi partner API catalogue and order event examples.",
};

const orderEvent = {
  id: "evt_demo_001",
  type: "order.paid",
  data: { orderId: "ord_demo_001", market: "GB", currency: "GBP", totalMinor: 2400 },
};

export default function DevelopersPage() {
  return (
    <div className={styles.innerPage}>
      <p className={styles.kicker}>Developer preview</p>
      <h1>Plan your Zayvi integration<span>.</span></h1>
      <p className={styles.lead}>Explore draft catalogue and order event examples. Partner credentials and live endpoints are pending.</p>
      <div className={styles.actions}>
        <a className={styles.primary} href="mailto:hello@zayvi.store?subject=Zayvi%20developer%20pilot">Enquire about pilot access</a>
      </div>
      <section className={styles.innerSection}>
        <h2>Catalogue example</h2>
        <p>Choose a market to view a local sample. Prices use integer minor currency units.</p>
        <CatalogueExample />
      </section>
      <section className={styles.innerSection}>
        <h2>Order event example</h2>
        <p>The draft event includes a stable event ID for deduplication and the paid order’s market, currency and total.</p>
        <pre className={styles.code} aria-label="Sample order event"><code>{JSON.stringify(orderEvent, null, 2)}</code></pre>
      </section>
    </div>
  );
}
