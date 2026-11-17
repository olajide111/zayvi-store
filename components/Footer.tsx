"use client";

import Link from "next/link";
import type { SocialLinks } from "@/lib/social-links";
import FooterSocialLinks from "./FooterSocialLinks";
import { contentUrl, type ContentMarket } from "@/lib/storefront-content";

type Props = {
  market: ContentMarket;
  socialLinks: SocialLinks;
  onShopAll: () => void;
};

export default function Footer({ market, socialLinks, onShopAll }: Props) {
  const cols = [
    {
      title: "Shop",
      items: [
        { label: "All Products", action: onShopAll },
        { label: "New In", action: onShopAll },
        { label: "Best Sellers", action: onShopAll },
        { label: "Travel", action: onShopAll },
        { label: "Beauty", action: onShopAll },
      ],
    },
    {
      title: "Help",
      items: [
        { label: "Shipping information", href: contentUrl(market, "shipping") },
        { label: "FAQs", href: contentUrl(market, "faqs") },
        { label: "Order Tracking", href: contentUrl(market, "tracking") },
        { label: "Contact Us", href: contentUrl(market, "contact") },
      ],
    },
    {
      title: "Company",
      items: [
        { label: "About Us", href: contentUrl(market, "about") },
        { label: "Privacy", href: contentUrl(market, "privacy") },
        { label: "Returns Policy", href: contentUrl(market, "returns") },
        { label: "Terms of sale", href: contentUrl(market, "terms") },
        { label: "Blog & guides", href: contentUrl(market) },
        { label: "Affiliate", href: contentUrl(market, "affiliate") },
      ],
    },
  ];

  return (
    <footer style={{ background: "#fff", borderTop: "1px solid #eee", padding: "48px 24px 32px" }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 32,
        }}
      >
        {cols.map((col) => (
          <div key={col.title}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#111", marginBottom: 14 }}>
              {col.title}
            </div>
            {col.items.map((item) => {
              const className = "block py-1 text-left text-[13px] text-[#52635b] hover:underline";
              return "href" in item
                ? <Link key={item.label} href={item.href} className={className}>{item.label}</Link>
                : <button key={item.label} type="button" onClick={item.action} className={className}>{item.label}</button>;
            })}
          </div>
        ))}
        <FooterSocialLinks links={socialLinks} />
      </div>
      <div
        style={{
          maxWidth: 1100,
          margin: "32px auto 0",
          paddingTop: 24,
          borderTop: "1px solid #f0f0f0",
          fontSize: 12,
          color: "#999",
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} ZAYVI. All rights reserved.
      </div>
    </footer>
  );
}
