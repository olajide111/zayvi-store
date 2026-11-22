# Theme and dashboard connection review — 21 November 2026

## Confirmed in source and automated checks

- All 30 theme IDs are unique and appear exactly once in gallery groups.
- Registry-backed editor, device demo and preview routes exist with unknown-theme handling.
- Every primary and grouped dashboard navigation link resolves to a page.
- Dashboard and Store setup now expose theme, discovery, sourcing and deployed-readiness links with explicit capability labels.
- Studio drafts are browser-local. Theme previews do not activate customer storefronts.
- Six additional directions and four signature/essential themes use sample catalogues. Original themes also offer a public catalogue preview; this does not load saved merchant branding/content.
- Discovery supports supplier feed ingestion, candidate quality flags and manual approval/rejection. Approval creates a product pending review, not a published product.
- Sourcing scoring is deterministic, based on available recorded inputs. It is not AI demand scoring.

## Remaining release work, in dependency order

1. Seller identity, tenant/store provisioning and store-scoped permissions.
2. Server-backed theme drafts, assets and validated section configuration.
3. Adapt every renderer to real market-priced products, variants, stock, merchant content and social links.
4. Store-scoped activation, immutable versions, preview and rollback, then real cart/checkout integration across every theme.
5. Server-enforced premium entitlements and billing before selling theme access.
6. Discovery research sources with provenance and freshness, background import jobs and duplicate handling.
7. Candidate scoring with evidence, confidence/missing-data indicators and explanations; calibrate against merchant decisions and outcomes. Keep human approval and no automatic publication.

No completion date is established. AI discovery is the next functional workstream after the connection gaps above; supplier review infrastructure can be reused. A model provider alone does not complete discovery or establish score validity.

## Verification limits

This is a source and automated connection audit. Page existence does not prove deployed API health, authenticated browser behaviour, payment execution or tenant isolation. Those require environment-backed acceptance checks. No AWS, database or payment configuration was changed in this review.
