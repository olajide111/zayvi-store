# Zayvi Original storefront redesign — 21 November 2026

## Direction

Warm white, forest ink, restrained editorial serif headings, simple controls and real product imagery. This is the flagship existing storefront, not a new mandatory layout for every tenant. Broad appeal is a design hypothesis, not a measured 90% preference or conversion claim.

Research references:
- Baymard homepage benchmark: https://baymard.com/homepage-and-category-usability/benchmark/page-types/homepage — category navigation, search and curated discovery as distinct routes.
- Shopify Dawn official listing: https://themes.shopify.com/themes/dawn/presets/dawn — product-led imagery, simplified typography and filtering/sorting.

## Implemented

- Hero uses up to three real catalogue products instead of unrelated landscape photography. Loading and empty content do not fabricate products.
- Header and category tiles use real catalogue categories. Mobile categories remain directly accessible in a horizontally scrolling row.
- Current edit uses loaded catalogue order without claiming unverified bestseller rankings.
- Product cards use contained product images, permanent quick view, price hierarchy, accessible focus outlines and a responsive two-column mobile grid.
- Products with colour or size options open the existing quick-view chooser. The card no longer silently picks the first option.
- Catalogue sorting supports low/high price and alphabetical order within the active market.
- Delivery, return and contact guidance replace generic trust slogans and an inactive newsletter form that promised an unsupported 10% discount.
- Footer removes example category links that previously opened the same generic collection.
- Reduced motion is respected, headings and buttons have explicit responsive styles, and market/Preview limitations stay visible.

## Verification and remaining work

Next.js production build and TypeScript checks pass. Four server-rendered component tests verify genuine categories/images, option-selection actions, permanent quick view and removal of inactive discount/subscription promises.

Visual browser acceptance at 390px, 820px and 1440px, real-device interaction, keyboard flows, image failure behaviour, layout shift and field performance remain to be measured. No conversion result is claimed. Checkout, stock authority and payment execution were not changed. Newsletter subscription needs a real consent and persistence backend before returning. Flagship extraction into a seller-configurable theme remains outstanding.

### Interaction follow-up

Quick view and the cart now use named modal dialogs, Escape-to-close, keyboard focus containment, scroll locking and trigger focus restoration. A closed quick view is unmounted; a closed cart is inert. Hero/category images now have explicit failure fallbacks. Quick view uses the original storefront's forest accent and its mobile rule is scoped to its own panel.

Six server-rendered component checks cover catalogue content, variant actions, support/navigation and modal markup. These do not exercise browser focus events. Local Chromium screenshot launch was blocked by the execution environment (`socket() failed: Operation not permitted`); responsive screenshots and keyboard interaction acceptance remain outstanding on Preview.

### Registered flagship theme

`original` is a registered free theme. Following the pilot-store decision, it appears as an ordinary option in Everyday retail & home, without a featured group, recommendation badge or setup shortcut. It does not overwrite an existing preference or automatically publish a theme. The regular studio, full-page demo, phone/tablet/desktop frames, appearance validation, immutable drafts and guarded Preview release paths accept the same registered ID.

The theme preview uses the Original homepage composition with product montage, real category counts and current edit; its collection, product, story and preview bag use the existing themed shop flow. Its palette and heading font are configurable. The standalone Zayvi storefront still uses its existing commerce/cart flow; theme demos do not create orders or payments. Matching API packaging/deployment is required before the deployed API will accept the newly registered theme. This is existing-account setup, not completed public seller registration or production publishing.
