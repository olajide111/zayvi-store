import type { Metadata } from "next";
import Link from "next/link";
import styles from "./platform.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.nav}>
          <Link className={styles.brand} href="/platform" aria-label="Zayvi platform home">zayvi<span>.</span></Link>
          <nav aria-label="Platform navigation" className={styles.links}>
            <Link href="/platform#features">Features</Link>
            <Link href="/platform#themes">Themes</Link>
            <Link href="/platform/developers">Developers</Link>
          </nav>
          <Link className={styles.navApp} href="/platform/app">Merchant app</Link>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <footer className={styles.footer}>
        <Link className={styles.brand} href="/platform">zayvi<span>.</span></Link>
        <nav aria-label="Footer navigation" className={styles.links}>
          <Link href="/platform#help">Help</Link>
          <Link href="/">Shop Zayvi</Link>
          <a href="mailto:hello@zayvi.store">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
