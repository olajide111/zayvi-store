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
