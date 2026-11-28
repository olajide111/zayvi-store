import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, BarChart3, Package, PanelsTopLeft } from "lucide-react";
import styles from "./platform.module.css";

export const metadata: Metadata = {
  title: "Zayvi | Commerce for independent businesses",
  description: "Explore the Zayvi merchant pilot, from storefront design to orders, inventory and sales reporting.",
};

const features = [
  { icon: PanelsTopLeft, title: "Design your storefront", detail: "Explore layouts and preview how your catalogue looks on desktop and mobile." },
  { icon: Package, title: "Run the day-to-day", detail: "Review orders, fulfilment, stock and returns from your merchant dashboard." },
  { icon: BarChart3, title: "See how each market sells", detail: "Review order volume and sales trends, with GBP and NGN reported separately." },
];

const pilotEmail = "mailto:hello@zayvi.store?subject=Zayvi%20merchant%20pilot";

export default function PlatformHome() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="platform-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Commerce for independent businesses</p>
          <h1 id="platform-title">Your shop.<br />Your way to sell<span>.</span></h1>
          <p className={styles.lead}>Build a storefront that feels like your brand and manage orders, stock and sales in one merchant workspace.</p>
          <div className={styles.actions}>
            <a className={styles.primary} href={pilotEmail}>Join the pilot <ArrowRight size={17} aria-hidden /></a>
            <a className={styles.textLink} href="#how-it-works">How it works <ArrowDownRight size={16} aria-hidden /></a>
          </div>
        </div>
        <figure className={styles.heroArt}>
          <Image src="/demo-photos/textiles-display.webp" alt="Patterned textiles arranged for a retail collection" fill priority sizes="(max-width: 760px) 100vw, 48vw" />
          <figcaption className={styles.artCaption}>Example storefront collection</figcaption>
        </figure>
      </section>

      <section id="features" className={styles.section}>
        <h2>From storefront to fulfilment</h2>
        <div className={styles.features}>
          {features.map(({ icon: Icon, title, detail }) => (
            <article key={title} className={styles.feature}>
              <Icon size={22} strokeWidth={1.6} aria-hidden />
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="themes" className={styles.editorial}>
        <div className={styles.themePhoto}>
          <Image src="/demo-photos/denim.webp" alt="Denim product photography for an apparel collection" fill sizes="(max-width: 760px) 100vw, 45vw" />
        </div>
        <div className={styles.editorialCopy}>
          <p className={styles.kicker}>Themes and industries</p>
          <h2>A storefront built around your products</h2>
          <p>Explore catalogue layouts for fashion, home and speciality retail. Pilot merchants can see how a theme works with their own products before publishing.</p>
          <Link className={styles.textLink} href="/platform/app#store-setup">See how to set up your store <ArrowRight size={17} aria-hidden /></Link>
        </div>
      </section>

      <section id="how-it-works" className={styles.section}>
        <h2>How the pilot works</h2>
        <ol className={styles.steps}>
          <li><h3>Tell us about your business</h3><p>Share your catalogue, market and how you fulfil orders.</p></li>
          <li><h3>Set up your shop</h3><p>Add products, configure delivery and preview a theme.</p></li>
          <li><h3>Test your selling workflow</h3><p>Review a test order, its fulfilment and the sales report before launch.</p></li>
        </ol>
      </section>
      <section id="help" className={styles.faq}>
        <h2>Pilot questions</h2>
        <details><summary>What does it cost?</summary><p>Request pilot pricing when you enquire. We’ll confirm scope and fees before you commit.</p></details>
        <details><summary>Can I build an integration?</summary><p>Explore the proposed catalogue and order event formats in the <Link href="/platform/developers">developer preview</Link>.</p></details>
        <details><summary>How do I get help?</summary><p>Email <a href="mailto:hello@zayvi.store">hello@zayvi.store</a> with your question.</p></details>
      </section>
    </>
  );
}
