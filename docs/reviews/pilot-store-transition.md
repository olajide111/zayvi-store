# Pilot store transition — preparation

Status: the user wants to make the current Zayvi store secondary and choose a different pilot. The user has clarified that this means a new store and that the present design should not be the default. The user has confirmed the new business name and catalogue are undecided; keep branding, product range and theme unconfigured. No store, domain, release, payment connection or data has been reassigned.

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

Original is retained as an ordinary optional free theme in Everyday retail & home. Its featured group, first-position registry treatment, recommendation label and setup shortcut are removed. Existing saved choices and store records are untouched. A blank setup still has no theme selected; public seller registration/provisioning remains unfinished. The new pilot has not been created or assigned a theme.
