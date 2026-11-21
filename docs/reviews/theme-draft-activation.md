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
