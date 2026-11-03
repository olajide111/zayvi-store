# Current Storefront Audit — Rebuild Baseline

**Date:** 3 November 2026  
**Branch:** zayvi-aws-integration  
**Purpose:** Identify what may be retained and what must be replaced before a customer-facing release.

## Executive finding

The existing storefront is a prototype, not a production-ready multi-market retail experience. The official rebuild may replace its design, page structure, catalogue and shopping flow. Preserve only infrastructure that passes security, operational and product review.

## Confirmed findings from repository inspection

| Area | Current implementation observed | Required action |
|---|---|---|
| Homepage | `app/page.tsx` is a client component holding the main storefront state and multiple informational page bodies | Refactor into data-driven route structure with server-rendered catalogue content where appropriate |
| Product catalogue | `lib/products.ts` exports a static in-code array with numeric IDs, fixed GBP prices and product copy | Replace with canonical product + market offer data; no static demo inventory in production |
| Product imagery | Catalogue mixes CloudFront test assets and external third-party image URLs | Use authorised media records and the private S3/CloudFront pipeline; record rights and provenance |
| Product cards | `components/ProductCard.tsx` displays a hard-coded five-star rating and "(24)" | Remove until genuine, traceable review data exists |
| Hero | `components/Hero.tsx` claims free shipping and 30-day returns | Remove unless verified seller/market policy and delivery rules support those claims |
| Cart | `components/CartDrawer.tsx` claims free worldwide shipping | Replace with market- and basket-specific shipping calculation |
| Policy content | `app/page.tsx` embeds privacy, returns, shipping and FAQ copy, including global delivery promises | Move to reviewed, versioned, seller- and market-specific policy content; obtain legal review where required |
| Currency | Product prices are rendered as fixed GBP values | Use market currency and price snapshots; no implicit FX conversion at display time |
| Checkout | Cart UI includes payment-related component wiring; no complete production checkout flow established by this inspection | Rebuild checkout around server-side order validation and hosted/tokenised payment-provider flows |
| Admin | Current admin session uses one shared password and signed cookie | Treat as interim bootstrap only; replace with identity, tenant memberships, role permissions, MFA and audit controls before multi-tenant production |
| Responsive design | Several components use inline styling and component-local CSS breakpoints | Create a tested design system and responsive page templates |
| Accessibility | Current inspected components use clickable non-semantic containers and hover-only Quick View behavior | Add keyboard, focus, screen-reader and WCAG 2.2 AA testing |

## Retain subject to review

- Next.js / React application foundation.
- Vercel Preview workflow and feature branch.
- Domain and branding identity.
- Private S3 bucket, CloudFront distribution and upload pipeline.
- Existing useful product image upload code after tenant-aware authorisation is implemented.
- Any payment-provider integration only after verifying account ownership, market availability, security and test-mode behavior.

## Production blockers

1. Demo products and unverified product claims.
2. Static prices and no confirmed market-specific offer validation.
3. Fake review/rating display.
4. Unsupported shipping and returns claims.
5. Policy text hard-coded into the homepage.
6. No demonstrated tenant isolation.
7. Shared-password admin is not suitable for external tenant users.
8. No demonstrated end-to-end order/payment/refund reconciliation.
9. No complete accessibility, performance or security test evidence.

## Next sequence

1. Complete and test tenant/store/role/entitlement foundations.
2. Define server-side store resolution and tenant context.
3. Build design tokens and shared accessible components.
4. Rebuild homepage, collection/search, product detail and cart using real market-aware data contracts.
5. Build checkout and customer account flows.
6. Add white-label theme and domain configuration.
7. Test cross-tenant isolation, accessibility, mobile performance and purchase journeys.
8. Release Preview for owner review only.

## Research references

- Baymard checkout UX research (updated 3 November 2026): https://baymard.com/research-articles/current-state-of-checkout-ux
- Shopify storefront design guidance: https://shopify.dev/docs/storefronts/themes/best-practices/design
- Shopify theme performance guidance: https://shopify.dev/docs/storefronts/themes/best-practices/performance
- Google Core Web Vitals guidance: https://developers.google.com/search/docs/appearance/core-web-vitals
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/

This audit is a code inspection snapshot, not a complete penetration test, usability study or legal review.
