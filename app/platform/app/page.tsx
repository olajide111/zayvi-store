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
      <p className={styles.lead}>New to Zayvi? Request access to the merchant pilot. Self-service account creation is pending.</p>
      <div className={styles.actions}>
        <a className={styles.primary} href="mailto:hello@zayvi.store?subject=Zayvi%20merchant%20pilot">Request pilot access <ArrowRight size={17} aria-hidden /></a>
        <Link className={styles.textLink} href="/admin">Existing admin sign in</Link>
      </div>
      <section id="store-setup" className={styles.innerSection}>
        <h2>Set up your store</h2>
        <p>Existing admins can open the business profile and continue to the launch checklist.</p>
        <ol className={styles.steps}>
          <li><h3>Describe your business</h3><p>Enter your store name, what you sell and the style you want for your shop.</p></li>
          <li><h3>Prepare your storefront</h3><p>Review your theme, catalogue, selling markets and delivery options.</p></li>
          <li><h3>Review a test order</h3><p>Check the merchant workflow through fulfilment and sales reporting.</p></li>
        </ol>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/admin?next=setup">Open store setup <ArrowRight size={17} aria-hidden /></Link>
        </div>
      </section>
    </div>
  );
}
