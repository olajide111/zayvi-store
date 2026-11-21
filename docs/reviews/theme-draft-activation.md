# Store-backed studio drafts — Preview activation

Implemented: immutable studio snapshots using migration 0002 tables; active main-store scope from the commerce service's configured tenant; row-locked version allocation; optimistic base-version conflict handling; authenticated platform-admin Next API; validated settings; editor save/history/restore. No release pointer is updated. This remains platform administration, not seller identity or paid entitlements.

## Dependencies

- Matching frontend and commerce Lambda code from this branch.
- Existing migration 0002 plus new migration 0030_theme_draft_access.sql. Setup flow separately requires 0029_store_setup.sql.
- Review/apply only a Preview Terraform migration plan; do not use production credentials or alter historical migrations.
- Migration 0030 adds SELECT/INSERT only to existing immutable, tenant-RLS-protected version rows. It grants no publishing authority.

## Acceptance checks after activation

1. Authenticate as platform admin; select a theme, customise colours/fonts and save a version.
2. Reopen the same theme on another device, refresh versions, load the saved version and confirm the same preview values.
3. Open two editor tabs. Save from one, then save from the older tab: expect 409 and an explicit refresh action, with no lost version.
4. Load an earlier version, then save: a new immutable version appears; earlier rows remain unchanged.
5. Invalid theme IDs, colours, fonts, negative base versions and unauthenticated requests must fail.
6. Verify the public storefront and published release pointer have not changed.
7. Check error/retry UI when the matching Lambda or migration is unavailable.

## Remaining work

- Seller registration, membership-scoped identity and entitlement checks.
- Connect setup-selected appearance and studio drafts into one editing lifecycle (currently separate saved preferences and versioned studio designs).
- Real products, variants, content and commerce integration across all renderers.
- Activation/rollback with release audit events after those renderers pass acceptance.
- Browser/database acceptance above has not been performed here. Unit tests use a query fake; they do not prove PostgreSQL permissions, RLS or deployment health.

## Catalogue preview follow-up

Canvas now exposes Current store catalogue alongside its illustrated demo. Catalogue mode deliberately uses the shared product-first renderer, rather than presenting the illustrated campaign as a live catalogue. It reads the public API's default enabled market and explicit currency, never performs FX conversion, and has no real checkout. All 30 themes now offer Current store catalogue. All ten newer directions/signatures use the shared registered layout for this mode; their distinct campaign demos remain separate. Native campaign data adapters are still pending.

The shared adapter retains real products with missing images (a labelled product placeholder is used), accepts HTTPS and same-origin relative image paths, and rejects mismatched market/currency or invalid prices. Loading, empty and error states do not substitute demo inventory. Errors offer retry. Variant validation, merchant content, actual stock reservation and checkout remain separate work.

## Merchant content follow-up

All shared catalogue previews now request the published About page for the exact catalogue market, and the saved storefront social profiles, through `/api/storefront/theme-content`. This route uses public published-content reads only. It never loads draft text or substitutes starter-page copy. Missing About pages and unavailable content services have distinct states; catalogue browsing remains usable. Only configured validated social URLs render, using the existing branded platform icons; an empty configuration hides the social section.

This does not yet provide editable theme sections, configurable navigation, policy-page embedding or native campaign content adapters. Merchant copy is rendered as escaped text, not executable HTML. Preview activation and browser/database acceptance remain pending.

## Guarded Preview release workflow

`/admin/themes/releases` now reviews saved designs against the current public catalogue and records publish/rollback actions through `/api/admin/theme-release`. Migration 0031 grants the application role access to existing release pointers and insert-only event history. Store-row locking and the expected current release ID prevent stale pointer changes. Repeating an already-current release does not insert another event; rollback requires prior release evidence.

Writes default to disabled. Enabling requires BOTH `THEME_RELEASE_MODE=preview` and the AWS-provided function name `zayvi-preview-api`. No Terraform environment flag was changed here. Production functions fail the guard. This is platform-admin Preview tooling, not seller launch or premium entitlement enforcement. Release events currently have no membership actor because the shared platform-admin session has no tenant membership identity; add that attribution with seller identity before production.

The homepage now has an optional Preview-only release renderer. It remains disabled by default, so recording a release alone does not change customer pages. This is not production seller publishing. Review/apply migrations 0029–0031 and matching API/frontend before environment acceptance. Exercise publish A, publish B, rollback A, stale pointer conflict, disabled writes and history preservation against PostgreSQL; local tests use a query fake.


## Complete Preview release rendering connection

After recording or rolling back a version, `/admin/themes/released` reads the validated current release from the commerce service, rather than query-string design values. It requires the platform-admin session. A later saved draft does not replace the release until explicitly released.

The homepage can use the same release only when the private server variable `ZAYVI_PREVIEW_THEME_STOREFRONT=enabled` AND Vercel's `VERCEL_ENV=preview` are both present. Production ignores the feature flag. No deployment environment variable was modified here. With the flag disabled, the existing storefront remains the default. With it enabled but no valid release, an explicit not-ready state appears rather than silently substituting a different theme.

Released catalogue fetching uses the resolved storefront market, so the saved appearance does not reset country selection. The shared renderer still has a preview bag and no payment execution. This is a reviewable Preview theme flow, not launch-ready seller commerce.

Acceptance: save A, release A, open released view; save B without releasing and confirm released A persists; release B, then rollback A and confirm the exact brand/appearance returns. Test default/disabled mode, production guard and market currency. Unit/query-fake tests cover release selection and guards; browser/PostgreSQL verification still requires deployment.
