# Zayvi storefront themes and business configuration

## Theme studio and design setup — current implementation

Admin → Design your store opens a three-step design questionnaire for an existing admin account: store name, business category and preferred visual direction. Answers are remembered on that browser and used to filter the theme gallery. This is not seller registration, tenant provisioning, cross-device onboarding, identity verification or launch readiness. Do not redirect all existing accounts into it automatically.

The gallery contains eighteen design concepts: twelve standard concepts and six locked premium previews, across six layout structures. Each opens a full-window editor without the admin sidebar. It uses an independently scrolling storefront iframe with genuine desktop, tablet and mobile viewport widths rather than shrinking a card. Sellers can also open the preview in a full tab. The editor provides brand name, headline, safe colour styles, typography and Off/Subtle/Expressive motion. Changes can be saved on that browser with an explicit local-only label.

Each concept has interactive Home, Collection, Product, Bag and Story previews. The demo catalogue varies by industry. Search, category filters, product detail, bag quantities, removal, empty states and currency-separated preview subtotals work without creating orders or executing payments. Theme changes remain design previews, not published storefronts. Current store catalogue mode loads only the public storefront API in the configured default market; errors and empty results are explicit and never silently replaced with demo products. Public catalogue mode does not yet load saved store content or brand assets.

Onboarding recommendations do not limit catalogue eligibility or alter selling markets. Browser storage is validated and failures are non-fatal. No product, market, payment or tenant record is changed. All preview pages identify demonstration mode, and checkout is unavailable. The actual storefront and commerce services remain unchanged.

### Industry coverage and premium collection

The business selector contains 25 categories including jewellery, footwear, bags, wellness, sport, baby/kids, toys, books/stationery, pets, automotive, garden/DIY, equipment, digital products, services and Other. Other accepts a bounded free-text description saved only with the browser profile; it never becomes executable markup or an authority for catalogue eligibility. Broad design recommendations map related industries to existing template families. Services, digital products and other categories do not imply that bookings, digital fulfilment, regulated goods or subscriptions are supported.

Six additional premium previews have distinct interactive modules: Cinema (campaign chapter navigation), Maison (room/category discovery), Prism (side-by-side product selection), Muse (editorial product markers), Terra (expandable story chapters) and District (department exploration). Product facts come only from the available catalogue. Demo markers/story copy are explicitly examples, never merchant-authored claims.

Premium cards have a locked badge and a preview action; their studio disables customisation and local draft saving for visitors without the verified platform-admin session. The server validates the existing signed admin cookie; valid platform admins can customise and save all theme previews. The present shared-password admin session is platform administration only and must not be reused as a future seller-admin identity. Seller plan checks cannot be inferred from an admin URL, browser flag or local storage. This is a preview-stage UX lock, **not a paid entitlement implementation**. Demo previews remain accessible by direct URL, including query options. No payment, price, trial, checkout or unlock is offered. Before monetisation, implement store-scoped server entitlement checks on every draft write, publishing operation, asset use and actual storefront rendering; implement an audited billing/provider lifecycle, refunds, revocations and downgrade policy. Browser flags and local storage must never grant premium access. Decide subscriptions versus one-time theme licences and prices separately before launch.

### Reference patterns and next delivery

WordPress separates theme discovery, demo/own-content previews and activation: https://wordpress.com/support/themes/choose-a-theme/
Shopify distinguishes editable draft themes from the single published theme: https://help.shopify.com/en/manual/online-store/themes/adding-themes
Zayvi adopts those workflow principles with original theme designs.

Still required: server-backed seller registration and tenant/store creation; authenticated store-scoped setup persistence; recommended defaults from the actual catalogue and markets; asset ownership; editable sections; immutable theme drafts with store previews; safe publishing and rollback; applying the approved renderer to actual customer routes. Studio concepts must not be marketed as released, purchasable themes.

Themes are intended as a principal selling point, with both conventional premium shops and expressive motion-led designs. Every released theme must cover homepage, collection/search, product, bag, content and responsive navigation. No autoplay audio, flashing effects, infinite animations or scroll hijacking. Motion respects reduced-motion settings, and the final commerce journey remains server-authoritative.

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

## Motion showroom reference

The supplied six-second video shows a horizontal clothing rail moving into a focused product/details view. A comparable premium showroom can be developed with keyboard/touch navigation, category navigation, focused product transitions and a persistent bag action. True 3D presentation requires suitable product models or multi-angle photography; flat catalogue images do not become genuine 3D. Cinema now contains a photo showroom rail with category browsing, focused product panels and preview-bag actions, plus a separately labelled, opt-in 3D viewer. The viewer loads an original procedural bottle model included with the project, not a seller catalogue item; it supports camera controls and reset, with loading/error/retry states. Seller model uploads and product-model mapping are not implemented. Retain the six premium designs by extending one of them rather than inventing more tiers.

Commercial access policy: Free sellers receive an explicitly defined standard-theme allowance; paid plans receive the theme/motion features in their server-side entitlements; platform admins can review and customise every design without purchasing a seller plan. All sellers may preview premium designs. Prices and which paid plan includes each feature remain undecided. Existing standard-theme motion previews do not establish future paid entitlements.

## Standalone device demos

Every theme has `/admin/themes/[themeId]/demo`, separate from design controls. An iframe keeps actual logical viewports (phone 390×844, tablet 820×1180, laptop 1366×900), rotation and fit/actual-size modes. Fitting scales the complete viewport frame, not the website layout width; navigation/bag state survives device changes because the iframe is not re-keyed. These are responsive simulations, not native browser/device certification. All demo commerce stays non-transactional.

The Cinema showroom has photo and 3D modes within the same premium design, preserving the six-premium collection. Its 3D runtime is lazily imported from the pinned `@google/model-viewer` package only after an explicit load action. The original generated sample asset is `public/models/showroom-bottle.gltf`; there is no third-party model licence or implied catalogue relationship. No AR, automatic rotation, camera permission or seller upload is enabled. Model-viewer control reference: https://modelviewer.dev/docs/

## Self-contained clothing showroom demo

Cinema opens directly into its showroom rather than a generic hero. Six original SVG garment illustrations (Storm, Ember, Moss, Chalk, Midnight and Rose) are bundled under `public/demo-garments`, with sample-only GBP prices. They are illustration assets, not photorealistic garment scans or physical goods. No external stock-image service or supplier is required to test. Photo/illustration mode includes category selection, horizontal touch/keyboard browsing, focused product panels, previous/next selection, full product detail and the same preview bag. Reduced-motion and Motion Off suppress entrance/hover motion. Public-catalogue mode continues to replace demo records with real publicly available records only; no garment samples are substituted on errors. Product variants, seller uploads, availability and checkout are not invented by this demonstration.

Cinema naming: one premium theme, two modes labelled Clothing rail (images) and 3D product viewer. `/demo?showroom=3d` opens the latter directly. The toolbar also switches modes (this reloads the demo and resets its bag), whereas changing device size preserves it. Selecting 3D mounts and loads the model immediately. A local static poster is always available during loading/failure, explicitly labelled; only a successful viewer load reveals the interactive model and enables rotate/reset controls. No claim of verified WebGL rendering follows from a successful production build alone.

## Free African-inspired designs and photographic examples

Adire and Accra are two additional free designs, bringing the catalogue to 14 standard/free concepts and six premium concepts. Adire uses an original indigo/ivory geometric treatment and an arched editorial image frame; Accra uses terracotta, gold and cobalt, bordered colour blocks and a contemporary market composition. These are distinct creative directions, not a claim that Africa has one visual style or that demo goods are authentic traditional crafts. Both use the existing full shopping previews, device demos, colour presets and local draft controls without premium locking.

Photographic demo assets are bundled as WebP files under `public/demo-photos`, not fetched from a third party during preview. Catalogue provenance:
- Puffer photograph: Erik Mclean, https://unsplash.com/photos/black-bubble-jacket-on-hanger-jo6IYbEnQ58
- Denim photograph: kemal alkan, https://unsplash.com/photos/blue-washed-jacket-hanging-on-white-door-_BDBEP0ePQc
- Textile display: WyteShot, https://unsplash.com/photos/colorful-textiles-with-intricate-patterns-hanging-on-display-Q43GOm-D06k
- Textile detail: WyteShot, https://unsplash.com/photos/colorful-african-fabric-with-intricate-patterns-and-designs-j60zrJOTn_o
The source pages identify these as free under the Unsplash licence. Demo names/prices do not establish seller stock, product specifications, textile origin or photographer endorsement. Photo credits appear in demo product descriptions.

Cinema's normal demo now offers photographic clothing only. The unrelated bottle is no longer promoted as a second clothing mode. Existing `showroom=3d` experimental URLs remain explicit bottle tests; they do not represent a finished photographic or 3D clothing showroom. Real clothing photographs are flat image assets, not reconstructed garment models.
