# Zayvi Storefront Experience Standard

**Status:** Approved product requirement for the official rebuild  
**Priority:** Major customer-facing product and white-label reference implementation  
**Design approach:** Premium, conversion-focused, mobile-first, accessible, fast and market-aware  
**Research reviewed:** 3 November 2026

## 1. Product objective

The Zayvi storefront is a major product, not a thin catalogue page. It must deliver a polished shopping experience for Zayvi's own store and become the reusable reference implementation for tenant-branded white-label stores.

The existing storefront may be substantially replaced. Preserve useful infrastructure (AWS private S3, CloudFront delivery, secure admin upload, domain and deployment setup) only where it passes review. Do not preserve demo catalogue content, unsupported shipping promises, invented returns terms, or hard-coded commercial claims merely for continuity.

## 2. Research basis

- Baymard Institute's 3 November 2026 checkout research reports that 59% of desktop and mobile sites in its benchmark have mediocre-or-worse checkout UX. Its recommendations include guest checkout, clear review of completed steps and reducing avoidable form friction: https://baymard.com/research-articles/current-state-of-checkout-ux
- Shopify's storefront design guidance recommends clear navigation, prominent product title/price/buy actions, discoverable product details, cohesive branding, trust-building patterns and real-user testing: https://shopify.dev/docs/storefronts/themes/best-practices/design
- Shopify's performance guidance highlights mobile CPU/network constraints, responsive images, adequate touch targets and preventing horizontal overflow: https://shopify.dev/docs/storefronts/themes/best-practices/performance
- Google recommends Core Web Vitals targets at the 75th percentile: LCP <= 2.5 seconds, INP < 200 milliseconds and CLS < 0.1: https://developers.google.com/search/docs/appearance/core-web-vitals
- W3C WCAG 2.2 is the accessibility acceptance baseline: https://www.w3.org/TR/WCAG22/

These are design inputs, not a substitute for usability testing with target customers in the UK and Nigeria.

## 3. Storefront information architecture

### Global shell
- Responsive header with brand, search, market/currency selector, account and cart.
- Clear primary navigation and category menu.
- Search with autocomplete, recent searches, typo tolerance and useful empty states.
- Footer with verified customer service, shipping, returns, privacy, terms and business information.
- Market selector must explain when changing market changes availability, price, delivery and product selection.

### Homepage
1. Optional announcement bar only for a real, current offer or service notice.
2. Editorial hero with clear value proposition, one primary action and strong art direction.
3. Curated category entry points.
4. Product collections driven by real catalogue and merchandising rules.
5. Editorial / brand story and trust information.
6. Useful discovery content such as buying guides, comparisons or recently viewed products.
7. Newsletter only with clear consent and value.
8. Footer with real policy links and support details.

Avoid a crowded homepage, generic stock sections, fake urgency, invented review counts and endless carousels. The page should explain what the store sells and why a shopper should trust it within seconds.

### Collection and search results
- Search, category filters and sorting.
- Filters appropriate to category (price, brand, size, compatibility, availability, etc.).
- Product cards with consistent image ratios, clear title, local price, variant cues and honest availability.
- Pagination or accessible load-more; avoid uncontrolled infinite scroll.
- Useful no-results state with filter reset and suggestions.
- Preserve search/filter state in URL where appropriate.

### Product detail
- High-quality authorised imagery, gallery and zoom.
- Clear title, brand, local price and variant selection.
- Stock/availability scoped to selected market.
- Delivery estimate only where supported by a current, attributable quote or validated service rule; identify estimate versus guarantee.
- Prominent add-to-cart action and clear quantity control.
- Product description, specifications, dimensions, compatibility and what's included.
- Returns/warranty information only when confirmed for the seller, product and market.
- Authentic reviews only when collected lawfully and tied to verified source records.
- Related products based on relevant attributes, not arbitrary filler.
- Structured product data and search metadata.

### Cart
- Edit quantities and variants, remove and save for later.
- Display item prices, discounts, delivery estimate/cost where known, taxes/fees where calculable, and clear total.
- Never advertise free shipping or a delivery date unless the market and basket qualify under a configured policy.
- Explain costs that cannot yet be calculated before checkout.

### Checkout
- Guest checkout as a first-class path; account creation optional and preferably after purchase.
- Short, clearly labelled steps with accessible inline validation.
- Address capture appropriate to destination market; avoid assuming UK postcode formats for every country.
- Show delivery options only if serviceable for the address and basket.
- Explain why required personal information is requested.
- Display order summary and all known charges before payment authorisation.
- Revalidate price, market eligibility, stock, delivery and promotions server-side.
- Use hosted/tokenised payment provider components; never store raw card data.
- Provide a final review and clear confirmation with order reference.
- Support retry and recoverable errors without losing the cart.

### Customer account
- Orders and status, addresses, preferences, returns requests and support.
- Guest order lookup with secure verification.
- Account deletion/export workflows and privacy controls.
- Do not require account creation to purchase unless a future justified business case is approved.

## 4. Visual direction

Aim for a distinctive premium retail identity rather than a generic template:
- Strong typography hierarchy and restrained colour system.
- Consistent spacing, grid, image treatment, iconography and component states.
- Editorial photography and product imagery with consistent art direction.
- Calm whitespace and clear content priority.
- Subtle motion only when it improves feedback; respect reduced-motion settings.
- Mobile layouts designed intentionally, not merely squeezed desktop layouts.
- Design tokens and reusable components so tenant themes can be configured safely.

The brand system should support tenant overrides for logo, colour, typography, imagery, tone and domain while retaining usability, accessibility and security constraints.

## 5. Multi-tenant white-label requirements

A tenant storefront is a configuration of the shared storefront engine, not a forked codebase.

Tenant/store configuration includes:
- Brand identity and theme tokens.
- Verified custom domain and domain ownership.
- Store locale, timezone and supported markets.
- Currency display and market-specific catalogue.
- Navigation, collections and merchandising.
- Policies, contact details and legal seller identity.
- Payment, shipping, tax and fulfilment integrations.
- SEO metadata, social preview and analytics consent.
- Feature entitlements and plan limits.

Tenant content, customers, orders, analytics and integrations must be isolated. The server resolves the tenant from a verified domain or trusted authenticated context; browser-provided tenant identifiers are never authoritative.

## 6. Trust and truthful commerce

The interface must not publish unsupported claims. In particular:
- No fabricated ratings, reviews, stock counts, sales counts or popularity labels.
- No unsupported "free shipping", "30-day returns", delivery windows, warranty or security claims.
- Clearly distinguish in-stock, supplier-confirmed, back-order, unavailable and unknown.
- Disclose seller/fulfilment identity where relevant.
- Market availability and prices are independent; missing market data means unknown, not available.
- Show local currency and explain additional charges before payment.
- Promotions must have real eligibility, dates and terms.
- Product images must have documented rights/authorisation.

The current prototype's hard-coded policy copy and demo products are not production truth and must be removed or replaced by configured, reviewed data.

## 7. Accessibility standard

Target WCAG 2.2 AA across key journeys:
- Full keyboard operation and visible focus.
- Semantic headings, landmarks, labels and buttons.
- Correct accessible names and error announcements.
- Sufficient colour contrast and non-colour status cues.
- Touch targets sized for comfortable mobile use.
- Reduced-motion support.
- Accessible dialogs, drawers, menus and product galleries.
- Screen-reader testing for search, cart and checkout.
- No keyboard traps or focus loss after cart updates.

Automated checks are necessary but do not replace manual keyboard and assistive-technology testing.

## 8. Performance and quality budgets

Measure field performance at the 75th percentile, segmented by mobile/desktop and market where volume allows:
- LCP <= 2.5s.
- INP < 200ms.
- CLS < 0.1.

Engineering practices:
- Responsive modern image formats and correct image dimensions.
- Prioritise the hero/LCP image; lazy-load below-the-fold imagery.
- Avoid unnecessary client-side JavaScript and third-party scripts.
- Server-render content that should be indexed and load quickly.
- Cache public catalogue/configuration safely; never cache private tenant/customer data across tenants.
- Test on mid-range mobile devices and constrained networks.
- Monitor route-level errors, checkout failures and API latency.

## 9. Conversion and product analytics

Track consent-aware events with a documented schema:
- view_home, search, view_collection, apply_filter, view_product.
- select_variant, add_to_cart, remove_from_cart, begin_checkout.
- add_shipping_info, add_payment_info, purchase, refund/return.
- search_no_results, out_of_stock, delivery_unavailable, checkout_error.

Segment by market, device, acquisition channel, tenant and product category where lawful. Never put personal or payment data into analytics events.

Measure conversion funnel, search success, product-to-cart rate, checkout completion, payment failure, return rate, repeat purchase and customer support contacts. Establish baselines before setting targets.

## 10. Design and validation process

1. Audit current implementation, route structure, components, demo content and security-sensitive flows.
2. Define design tokens, component library and tenant theme contract.
3. Produce responsive page designs for home, collection, search, product, cart, checkout, account and order status.
4. Test prototypes with target shoppers in UK and Nigeria.
5. Implement shared components and market-aware data contracts.
6. Run accessibility, responsive, performance, SEO and security checks.
7. Conduct end-to-end purchase tests using payment-provider test mode.
8. Release to Preview for owner review; no Production launch without explicit approval.

### Acceptance criteria
- A shopper can find a product, understand price/availability/delivery, add it to cart and complete a test checkout without creating an account.
- Market selection changes only to records and offers valid for that market.
- No unsupported shipping, stock, review or returns claim is visible.
- Core journeys work by keyboard and screen reader.
- Layout works from small mobile screens through wide desktop.
- Core Web Vitals meet targets in representative testing or documented remediation exists.
- Tenant A cannot access tenant B's storefront data or private assets.
- All policies and seller details are sourced from reviewed configuration.
- Product, order and payment states are server-authoritative.

## 11. Explicit non-goals for the first release

- No attempt to reproduce every feature of large marketplace platforms.
- No AI chatbot as a substitute for good navigation and product information.
- No fake reviews, urgency, scarcity or popularity.
- No custom payment processor or storage of raw card data.
- No unverified multi-country delivery promise.
- No premature visual complexity that harms speed or accessibility.

## 12. Implementation note

The repository currently contains a client-heavy homepage and hard-coded policy text. Before redesign implementation, inspect all routes/components and remove demo assumptions. The Next.js app should be refactored into server-rendered, data-driven, tenant-aware storefront routes. This document defines the target; it does not claim the target has already been implemented.
