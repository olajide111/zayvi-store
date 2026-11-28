import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "../platform.module.css";

export const metadata: Metadata = {
  title: "Merchant app | Zayvi",
  description: "Enter the existing Zayvi merchant workspace or enquire about the merchant pilot.",
};

export default function MerchantEntry() {
  return (
    <div className={styles.innerPage}>
      <p className={styles.kicker}>Merchant app</p>
      <h1>Manage your Zayvi shop<span>.</span></h1>
      <p className={styles.lead}>Use your existing merchant access to open the Zayvi dashboard. New stores join through the pilot.</p>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/admin">Merchant sign in <ArrowRight size={17} aria-hidden /></Link>
        <a className={styles.textLink} href="mailto:hello@zayvi.store?subject=Zayvi%20merchant%20pilot">Join the pilot</a>
      </div>
      <section className={styles.innerSection}>
        <h2>Set up your store</h2>
        <ol className={styles.steps}>
          <li><h3>Set your market and delivery</h3><p>Confirm where you sell, your currency and how orders reach customers.</p></li>
          <li><h3>Add products and choose a theme</h3><p>Review your catalogue and storefront before publishing.</p></li>
          <li><h3>Review a test order</h3><p>Check the merchant workflow through fulfilment and sales reporting.</p></li>
        </ol>
      </section>
    </div>
  );
}
