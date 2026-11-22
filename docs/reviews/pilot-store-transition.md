# Pilot store transition — preparation

Status: the user wants to make the current Zayvi store secondary and choose a different pilot. The user has clarified that this means a new store and that the present design should not be the default. The user has named the pilot Hammy Store, confirmed general fashion for men, women, children and babies, and authorized choosing the most suitable existing theme. Atelier is selected for this pilot only, with white/ink/cobalt appearance. No store, domain, release, payment connection or data has been reassigned.

## Distinguish the choices

- Another theme for the same shop: save a separate theme version and compare its real catalogue preview. Keep the current release until an explicit reviewed Preview release. This retains the same products, orders, customers and integrations.
- Another business/shop: provision and verify an isolated tenant/store context before attaching its catalogue, domains, owners or payment connections. Do not achieve this by renaming the current main store or changing an environment variable on the existing commerce API.

Zayvi Original remains a reusable free theme regardless of the pilot business. A demo is not a provisioned independent store. The current store remains a secondary test/reference store as the intended role; no database status has been changed.

## Confirmed source constraints

- `infra/lambda/index.js:withTenant` uses server-configured `TENANT_SLUG`, defaulting to `zayvi`.
- Setup, design versions, release pointers, markets, social links, published content, draft orders and Kredal connection resolution select the tenant's `main` store.
- `app/api/admin/dashboard/route.ts` and `components/admin/AdminWorkspace.tsx` still contain fixed Zayvi display names; those labels do not prove which store owns the records.
- The shared platform-admin session is not seller membership authentication. Tenant/member/domain security requirements are documented in `docs/architecture/tenant-context-and-api-security.md`.

## Implementation sequence for a separate shop

1. Confirm candidate business, existing/new store status, GB/NG markets and chosen theme. Record intended owner and domain without collecting secrets in chat.
2. Provision its own tenant/store records and authenticated membership. Keep server authorization authoritative; browser-supplied store IDs are selectors only.
3. Resolve every admin/storefront operation to that validated context. Audit tenant-only catalogue/operations queries as well as store-ID queries; a cosmetic store picker is insufficient.
4. Add visible actual store identity throughout setup, themes, orders, products, payments and releases. Verify an unavailable context blocks writes rather than falling back to the current Zayvi store.
5. Attach only explicitly selected catalogue/content assets. Keep historical customers, orders, refunds, feeds, credentials and releases in their original scope.
6. Configure a separate test payment connection and verified domain mapping if required. Do not repoint existing webhook ownership or reuse a business connection by renaming it.
7. Test isolation, setup appearance save/reopen, immutable history, catalogue/market pricing, test checkout, webhook/refund mapping and disabled real fulfilment. A theme demo or successful frontend build does not prove these.
8. Record the new shop as pilot only after those checks. Archive/delete nothing as part of the pilot selection.

## Current evidence

Operator apply output confirms Preview API refresh and migrations 0029–0031; email notifications remain configured. Theme/setup/history/release-review frontend changes have Ready Preview deployments. Live save/restore and release browser acceptance remain unverified because the available browser reached Vercel Authentication. Production and real fulfilment remain outside this transition.

## Default-design correction

Original is retained as an ordinary optional free theme in Everyday retail & home. Its featured group, first-position registry treatment, recommendation label and setup shortcut are removed. Existing saved choices and store records are untouched. A blank setup still has no theme selected; public seller registration/provisioning remains unfinished. Hammy has a selected design brief, but independent tenant/store records have not been created.

## Hammy Store design preview

`/admin/pilots/hammy` provides the separate pilot brief; `/demo` supplies phone/tablet/laptop frames and `/preview` renders the selected Atelier design with Hammy branding. Its Women, Men, Kids and Baby departments use an explicitly illustrative sample catalogue. No setup API write occurs, and the pilot route cannot be switched to the current store catalogue by query string. Existing studio/demo routes remain unchanged. Sample GBP prices do not enable a market or represent real inventory. No studio-save shortcut points this pilot at the existing store.

Kids/baby demo images are sourced from Unsplash pages identifying free-use photographs under the Unsplash License: Amanda Selby, “Baby clothes, sandals, and toy camera flat lay” (`https://unsplash.com/photos/baby-clothes-sandals-and-toy-camera-flat-lay-72l_I4s-hss`), and CARMELA LUSTRE, “Baby clothes in a woven basket” (`https://unsplash.com/photos/baby-clothes-in-a-woven-basket-AkPas1rErdE`). They are illustrative images, not evidence of Hammy inventory. Adult/editorial photographs reuse existing project demo assets. Replace samples with merchant-owned or supplier-authorized product photographs before selling.

## Hammy shopping-flow follow-up

Hammy now uses a dedicated fashion presentation built around the selected Atelier direction, rather than the generic shared preview bag. Its eight departments are Women, Men, Kids, Baby, Sportswear, Footwear, Accessories and Traditional, with fourteen illustrative styles. Browse/product/basket states use real Next navigation links and validated department selection; invalid product IDs show a not-found state rather than substituting another product. Search and sorting are available.

Cards lead to product choices. Product pages require size/colour, offer quantity selection, up to twenty unique gallery pictures, thumbnails and enlarged-image viewing. Adding opens an accessible basket panel with the selected options; identical options merge, distinct options remain separate, quantities can be changed and lines removed. The full basket has a clear unavailable-checkout explanation. A Hammy-only session key preserves validated preview lines through refresh in the same tab; browser-provided totals are discarded. This does not establish stock availability, verify real options or execute an order/payment. No current-store catalogue or payment API is called.

Demo galleries are explicitly illustrative style imagery, not verified multiple views of a stocked garment. Additional free-use Unsplash references: Jonathan Mattson, “A white t-shirt hanging on a white wall” (`https://unsplash.com/photos/a-white-t-shirt-hanging-on-a-white-wall-fiA7sq2PdnQ`); Jadon Johnson, “A woman in athletic wear stands outdoors” (`https://unsplash.com/photos/a-woman-in-athletic-wear-stands-outdoors-Wp7KtcAZAo8`); mostafa mahmoudi, running shoes and shoe close-up (`https://unsplash.com/photos/a-pair-of-running-shoes-on-a-white-background-W_uDEmTq0po`, `https://unsplash.com/photos/a-close-up-of-a-shoe-on-a-white-background-beoVfTZDEb4`). Each source page identifies the Unsplash License. Real Hammy products need their own accurate photography, measurements, variants, market prices and inventory.

Nine focused tests pass for basket variant identity, quantity limits, storage validation, twenty-image gallery bounds, department coverage, product options, route filtering and sample-data isolation. TypeScript and production build are checked separately. Live interactive browser acceptance remains pending behind Vercel Authentication. New-store provisioning and real checkout remain unfinished.


### Hammy browsing refinements

- Added intersecting collection filters for size, colour and budget, with an explicit reset and empty state. Available size/colour choices come from the current department's illustrative catalogue.
- Added bounded related-style suggestions, prioritising the current product's category and audience without repeating that product.
- Added previous/next gallery controls, arrow-key thumbnail navigation and an enlarged gallery with arrow keys. Mobile purchase actions retain the chosen options beside the add button.
- Home collection cards remain independent of a previous collection search. Hammy continues to use only its sample catalogue; this does not provision a tenant or enable checkout.
- Verification: TypeScript and production build plus 11 focused tests. Real browser interaction/visual acceptance still requires the protected Preview session.

### Hammy responsive editorial identity

- Replaced the generic two-panel hero with oversized typography, overlapping editorial photos and a Hammy monogram stamp. Added numbered department tiles, a static typographic strip, a cobalt sportswear/footwear feature and a structured footer.
- Updated Hammy's private design palette to warm white/ink/cobalt, with soft yellow used for editorial accents. These choices remain specific to Hammy.
- Responsive layouts cover narrow phones (including a 320px rule), phones, tablets, laptops and wide desktops. Department navigation becomes four columns across two rows on phones; product detail stacks, controls wrap, the basket uses the full viewport and gallery height accounts for dynamic browser chrome. Touch controls use at least 44px targets and reduced-motion preferences disable hover transitions.
- Kept product galleries, required options, filtering and variant-aware basket behaviour. Hero/product lead images load eagerly; lower-page imagery remains lazy loaded. Illustrative photos and checkout restrictions remain explicit.
- Verification: 12 focused tests, TypeScript check and production build. Attempted local Playwright checks at 320, 390, 768, 1024 and 1440 pixels; Chromium could not launch because the execution environment denied its socket operation. No visual viewport acceptance or screenshot evidence is claimed.


### Hammy basket editing and recovery

- Shoppers can edit a basket line's size/colour inline, without removing/re-adding it. A matching variant merges quantities using the existing cap; invalid options and over-limit merges leave the previous basket intact.
- Removal exposes an undo for the last removed line, including its options and quantity. Restoring also uses the same cap and does not silently lose quantity.
- Quantity cannot be reduced below one using the minus control; removal is explicit. Quantity and edit feedback use a live status message. Keyboard focus moves to the editor, returns after saving/cancelling, and moves to Undo after removal. Escape first cancels an inline edit before closing the surrounding basket.
- Changes apply to the same Hammy-only session basket in the drawer and full basket. Checkout and real inventory remain disabled/unconfigured.
- Verification: 15 focused tests and production build. Interactive browser acceptance remains outstanding due to the previously observed Chromium launch restriction.


### Hammy collection context

- Search, size, colour, budget and sort choices are encoded in the current collection URL using Next's integrated native history support. Typing/filter changes replace the current entry rather than adding one history entry per keystroke.
- Product links, basket links and return-to-collection links carry that context. Server rendering restores a valid filter URL, including after refresh; client search parameters drive restoration after browser history navigation.
- Added individually removable active-filter chips. Clear-all retains the selected sort order. New department links start a fresh collection.
- URL inputs are bounded and validated against Hammy's sample catalogue, with consistent handling of repeated parameters on server and client. No arbitrary redirect URL or external catalogue is accepted.
- Verification: 18 focused tests cover URL round trips, malformed inputs, server-rendered filtered results and preserved product return links, alongside prior basket/gallery coverage. Interactive browser history checks remain outstanding under the existing browser restriction.

### Catalogue gallery foundation (requires Preview API deployment)

The backend audit found that `withTenant` selects a server-configured tenant (default `zayvi`), while multiple operations explicitly select that tenant's `main` store. The Hammy pilot remains isolated demo data; this work does not create or rename a store, introduce an owner identity or enable real inventory/checkout.

The real catalogue now has a prepared gallery contract:

- Product create/update validates an ordered set of up to 20 images including the primary image, stores it in the existing product attributes JSON and returns the gallery through catalogue reads. No SQL migration is required. Existing single-image products still work.
- Supplier-feed gallery reads only expose the exact primary image already approved for the requested market. Additional images cannot inherit that approval.
- The admin product form accepts additional URLs, one per line, only when the commerce API advertises `productGalleryVersion: 1`. An older deployed API leaves gallery editing disabled rather than silently discarding it.
- Storefront product details and quick view use a shared thumbnail/previous/next gallery. Hammy's sample gallery remains separate.
- Verification: 22 focused tests cover existing Hammy flows plus gallery validation, maximum image count, clearing/partial update behaviour, supplier rights and legacy rendering. Frontend production and Lambda builds are required before deployment.

Activation is a separate Preview operation: package the reviewed commerce Lambda, create/review a fresh Preview Terraform plan while retaining private webhook/SNS inputs, and apply only the expected API change after resolving any other proposed changes. Verify the advertised gallery version, save one owned test product with two photos, reload it and check both storefront views. Do not point Hammy at the old store to perform this check. No AWS resources were changed by this code update.

Remaining pilot prerequisites: independent tenant/store provisioning, owner-scoped authentication, product/variant SKU inventory, explicit market pricing and policies, and Hammy's own test payment connection. These are not verified by the design preview.


### Hammy cooler palette

Replaced the yellow editorial accents with pale blue and shifted the canvas, borders, image placeholders and basket summary to cooler neutrals. The sportswear CTA uses white against cobalt; its hover state stays within the same blue family. The overview palette and copy match the storefront. This is a visual-only update; the earlier yellow direction is superseded.


### Default Store v1 and customised Hammy

The user requested that the current starter be called Default Store in the dashboard, with future improvements scoped to their customised Hammy Store. The dashboard entry now opens `/admin/pilots/default`, with a separate link to Hammy.

Default Store v1 has an independent copy of the current responsive design, CSS, sample catalogue, shopping helpers and navigation helpers. It does not import Hammy's implementation or configuration. Its preview URLs, product IDs and session basket key are separate. Version 1 adds shopping shortcuts for everyday, occasion, sports and children’s edits before being retained as the baseline.

Hammy retains its own files and existing preview basket. Its overview explains the separation. `AGENTS.md` records that future unqualified storefront improvements apply to Hammy; changing Default Store requires an explicit baseline request. Shared framework/accessibility utilities remain shared, but there is no Hammy design dependency in the saved starter.

This names and versions the design baseline; it does not rename database store records, activate a default for every tenant, provision a new tenant or enable checkout. The independent-store and gallery-API activation prerequisites above remain outstanding.

Baseline verification: production build and 23 focused baseline/Hammy/dashboard checks passed. Visual browser acceptance remains outstanding under the previously documented browser restriction.


### Hammy-only product photo workspace

Added `/admin/pilots/hammy/photos`, linked from Hammy's overview, without changing Default Store v1. It selects up to 20 supported images (5 MB each), displays local previews, changes image order and uploads selected files sequentially through the existing authenticated product-image endpoint. Successful uploads are retained in the current workspace; failed files can be retried independently, and the queue can stop after the current request.

The workspace validates complete upload responses, handles session expiry without discarding the selection, bounds waiting per upload, revokes local object URLs and avoids uploading already successful rows again. The full ordered gallery list is available only when all selected images have confirmed URLs. Selection/order are page-local; the UI tells the user to copy URLs before leaving. Removing a row or clearing the workspace does not delete stored files.

This uploads image assets only. It does not attach them to the existing store, save/publish a product, provision Hammy or enable checkout. Gallery persistence still needs the reviewed Preview API deployment and independent store setup. No real image uploads were exercised during verification.

Verification: 29 focused photo-workspace/baseline/Hammy/dashboard checks passed, including mocked upload, authentication and malformed-response cases. Frontend production build passed. Browser interaction and live AWS upload checks remain outstanding.


### Separate store dashboard entries; pictures deferred

Default Store and Hammy Store now have independent entries in the Stores navigation group, used by the desktop sidebar, mobile menu and page search. Their active routes do not overlap. Default Store's overview is a neutral, versioned starter reference rather than the route to Hammy. Hammy's overview is a distinct dark-ink working-store dashboard, with direct shopping/device-preview links, department navigation and clearly unverified selling-setup priorities.

Picture work is deferred per the user. The existing workspace is retained in a collapsed saved-for-later section; no image-upload code or image assets changed. No changes were made to Default Store's retained shopping component, CSS, sample catalogue or helpers. This update changes dashboard presentation and navigation, not backend store identities, operational data scope or checkout activation.

Verification: production build and 26 focused dashboard/baseline/Hammy checks passed. A source diff confirmed the retained Default Store shopping component, CSS, catalogue and helpers are unchanged from the saved v1 baseline. Browser visual acceptance remains outstanding.

### Generic template naming and extensible dashboard pages

The saved starter's dashboard label is now Store Templates, with Fashion starter v1 inside its demo. The working store entry is My Store — Hammy. Internal paths, preview identities and the retained starter shopping implementation remain unchanged.

Dashboard destinations and search now share one typed registry in `components/admin/admin-navigation.ts`, consumed by desktop/mobile navigation and page search. Extension instructions are in `docs/admin-navigation.md`. Checks cover duplicate routes, missing page files, title search and the independent store destinations. This is developer-extensible navigation, not a no-code page generator or new store provisioning.

Verification: TypeScript and 28 focused navigation/baseline/Hammy checks passed; production build passed. No retained starter shopping files or photo-workspace code changed. Browser visual acceptance remains outstanding.


### Hammy integration review and add-to-basket feedback

A source review confirms Hammy's storefront still imports its sample catalogue and stores its basket in browser session storage. No real order, payment or stock-reservation request occurs when adding. Backend tenant selection and main-store queries remain independent provisioning work. The platform's earlier Kredal Preview tests do not establish a Hammy business/store connection.

Added a Hammy-only integration-status page linked from its workspace. It explicitly distinguishes implemented preview features, unconnected catalogue/inventory/payments, unverified store/owner access, unconfigured delivery/policies and disabled checkout. It is labelled a source review, not a live health check. Gallery API activation remains pending and photo work remains deferred.

Hammy adds now show a 104×124px product thumbnail travelling toward the basket, an arrival pulse, an Added button state and a slide-in confirmation with the exact chosen options, quantity and preview subtotal. Reduced-motion preferences skip movement and open confirmation immediately. The local basket commits before presentation, capacity errors never trigger success feedback, rapid additions are guarded while motion runs, and missing animation support falls back to immediate confirmation. Route changes/unmount cancel the delayed drawer; dismissal restores focus to its origin. Default Store v1 shopping code is unchanged.

Verification: 32 focused tests cover motion endpoint geometry on phone/desktop sizes, actual variant receipt values, capacity failure preservation, the integration review and existing navigation/basket flows. TypeScript and production build passed. Interactive animation/device and live backend integration checks remain outstanding under the documented browser/runtime limitations. No AWS resources, products or orders were changed.
