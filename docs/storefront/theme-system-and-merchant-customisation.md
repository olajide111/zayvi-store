# Zayvi storefront themes and business configuration

## Decision

Zayvi is one multi-tenant commerce platform with multiple storefront experiences. It is not one fixed design copied for every merchant, and it is not a collection of separately maintained website codebases.

The platform owns the rendering system, design tokens, accessible components, page templates and commerce workflows. Each tenant configures a theme, selects an industry-appropriate starting template, and controls the content and features they are entitled to use.

Zayvi Commerce uses a premium flagship theme as the reference storefront. Zayvi Enterprise tenants can create materially different branded storefronts on the same platform.

## Three levels of customisation

1. Brand identity: logo, favicon, colour palette, typography, button treatment, imagery, tone of voice and social links.
2. Store experience: homepage sections and order, navigation, collection presentation, product-card style, product-page layout, editorial content and footer.
3. Commerce configuration: market, currency, locale, catalogue visibility, product attributes, variants, payment providers, shipping zones, tax settings, policies and enabled modules.

Customisation is constrained by accessible design tokens and supported components. Merchants cannot inject arbitrary scripts or unsafe HTML into storefront pages.

## Starting template families

Templates are industry starting points, not hard-coded industry silos. A merchant can switch templates while retaining products, orders, customers and brand settings.

- Editorial / premium retail: fashion, beauty, lifestyle and curated brands. Strong photography, editorial storytelling and collection-led discovery.
- Product / specification retail: electronics, appliances and equipment. Comparison, technical attributes, compatibility and warranty information.
- Grocery / convenience: category-first browsing, repeat ordering, fulfilment windows and availability.
- Home / furniture: room imagery, dimensions, materials, variants and delivery constraints.
- Wholesale / B2B: account-specific price lists, minimum quantities, tiered pricing, quote requests and reorder workflows.
- General commerce: balanced flexible layout for merchants whose catalogue spans categories.

Template selection may recommend modules based on product taxonomy, but it must not infer or enable regulated features without merchant configuration and compliance checks.

## Page system

Each storefront is assembled from typed, versioned sections:

- Global shell: announcement, header, navigation, search, market selector, footer.
- Homepage: hero, category navigation, featured collections, editorial content, product grids, brand story and trust/policy content.
- Collection/search: filters, sorting, facets, product grid, pagination and useful empty states.
- Product detail: media gallery, title, market price, variants, availability, delivery estimate, specifications, evidence-backed claims and add-to-cart.
- Cart and checkout: transparent subtotal, verified charges, delivery choices, address validation, payment and final order review.
- Customer area: account, orders, tracking, returns/support and privacy controls.
- Content pages: about, contact, policies, FAQs and campaign landing pages.

Section settings must be schema-validated. Each section has a stable type, version, settings schema, accessibility requirements and allowed data sources. Unsupported or invalid sections fall back safely and are reported to the merchant.

## Suggested configuration contract

The persisted configuration should be versioned JSON validated against server-owned schemas. It is not arbitrary executable code.

Example conceptual shape:

```json
{
  "schemaVersion": 1,
  "template": {
    "family": "editorial",
    "version": "1.0.0"
  },
  "brand": {
    "displayName": "Merchant name",
    "logoAssetId": null,
    "faviconAssetId": null,
    "palette": "warm-neutral",
    "headingFont": "editorial-serif",
    "bodyFont": "modern-sans"
  },
  "storefront": {
    "homeSections": [
      { "type": "hero", "version": 1, "enabled": true, "settings": {} },
      { "type": "collection-grid", "version": 1, "enabled": true, "settings": {} }
    ],
    "productLayout": "gallery-details",
    "collectionLayout": "product-grid"
  },
  "localisation": {
    "defaultMarket": "GB",
    "enabledMarkets": ["GB"],
    "defaultLocale": "en-GB"
  }
}
```

This is an illustrative contract, not a production API payload. Real schemas must validate asset ownership, supported template versions, tenant entitlements, market availability and section settings.

## Data and tenant boundaries

- Every tenant-owned theme/configuration record is scoped to tenant_id and store_id.
- Store domains resolve to a store, then server-side identity and membership determine tenant access.
- Theme configuration never determines tenant identity or authorisation.
- Product, offer, inventory, price, tax and delivery facts come from commerce services, not theme JSON.
- A market selector changes the active market context and must trigger server-side revalidation of product eligibility, price, inventory, tax and delivery.
- Shared platform templates are platform-owned and read-only to tenants; tenant overrides are separate records.
- Asset references must point to assets owned by the tenant or explicitly licensed platform assets.

## Merchant design studio

The eventual merchant editor should provide:
- Template gallery with desktop and mobile previews.
- Brand settings for logo, colours, typography and favicon.
- Page/section editor with reorder, hide/show and safe settings controls.
- Market and locale settings.
- Product and collection presentation settings.
- Preview links that do not expose drafts publicly.
- Draft, publish and rollback history.
- Validation warnings for missing policy pages, inaccessible contrast, missing alt text, broken links, unsupported market settings and invalid content.
- Role-based permissions: only authorised store roles can edit or publish themes.

The editor should not promise a fully free-form page builder at launch. Start with high-quality templates and configurable sections, then expand based on merchant usage.

## Design quality and accessibility gates

- WCAG 2.2 AA baseline across all templates.
- Keyboard navigation, visible focus, semantic headings, labels, accessible dialogs and reduced-motion support.
- Responsive layouts tested on small mobile, tablet and desktop.
- Core Web Vitals p75 targets: LCP <= 2.5 seconds, INP < 200 ms, CLS < 0.1.
- Optimised responsive images, lazy loading below the fold and limited third-party scripts.
- No fabricated reviews, popularity, scarcity, stock, delivery promises, guarantees or policy claims.
- All commercial claims must be supplied by the merchant or supported by verified platform data.

## Rollout

### Phase 1 — platform foundations
Define typed theme schemas, token system, section registry, asset ownership and tenant/store configuration records. Keep the current Zayvi flagship as the first reference implementation.

### Phase 2 — first template families
Build editorial, general commerce and product/specification templates. Test them with representative catalogues and mobile journeys.

### Phase 3 — merchant studio
Add draft editing, preview, validation, publishing, version history and rollback with role-based permissions.

### Phase 4 — industry modules
Add grocery, home/furniture and wholesale-specific sections and workflows only when their underlying inventory, pricing, fulfilment and account services exist.

### Phase 5 — ecosystem
Add approved integrations, custom domains, API/SDK access, advanced analytics and enterprise multi-store controls.

## Acceptance criteria

- Two tenants can use visibly different template families and brand identities without code forks.
- A theme change does not alter or transfer products, customers, orders or payment records.
- Tenant A cannot read or modify Tenant B theme configuration or assets.
- Draft changes are private until explicitly published by an authorised role.
- A rollback restores the previous published theme version.
- Market changes cannot bypass product eligibility, stock, price or compliance checks.
- Every template passes the accessibility, responsive and performance gates before general release.
