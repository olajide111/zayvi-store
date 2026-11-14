# Zayvi global commerce data model

**Status:** Target domain model for the official rebuild. This document is a design contract, not evidence that a database has been provisioned.

## Core rule

A product is a global identity. Supplier offers, availability, pricing, compliance, delivery, profitability, publication and fulfilment are scoped to a destination market. A missing product-market record means **unknown / not assessed**, never available.

## Initial markets

| Code | Market | Currency | Locale |
|---|---|---|---|
| GB | United Kingdom | GBP | en-GB |
| NG | Nigeria | NGN | en-NG |

The market registry must remain extensible. Currency, locale, timezone, tax configuration, delivery targets and supported payment methods are market configuration, not hard-coded assumptions in UI components.

## Database foundation migrations

The current schema foundations are expressed as ordered SQL migrations:

- `0001_multi_tenant_foundation.sql` — tenants, memberships, stores, plans and tenant isolation.
- `0002_storefront_theme_versions.sql` — immutable tenant-owned theme versions and release history.
- `0003_catalogue_market_foundation.sql` — platform canonical product identities and market registry, plus tenant-owned catalogue selections, suppliers, supplier offers, product-market readiness and evidence.

Migration 0003 deliberately separates the shared canonical product identity from tenant-owned commercial records. Supplier verification belongs to the tenant that performed it; it is not a platform-wide endorsement. GB and NG market records are inserted disabled by default. A market record must be explicitly enabled after its configuration and operational controls are reviewed.

The SQL files are design-stage migrations only. They have **not** been applied to a live database or validated against a running PostgreSQL instance. Before use, test all migrations in order against the chosen PostgreSQL version, validate RLS behaviour using the intended non-superuser application role, and add automated isolation, referential-integrity and rollback tests. The application must set `app.tenant_id` transaction-locally only after trusted server-side identity and membership resolution.

## Domain entities and responsibilities

1. **Market** — country/market identity, currency, locale, timezone, enabled state and configuration version.
2. **Product** — canonical product identity, brand, category, attributes, variants and lifecycle state. It does not own market availability or price.
3. **ProductMedia** — media object key, public/private classification, source, rights/authorisation, checksum, dimensions and moderation status.
4. **Supplier** — legal/business identity, contact and location records, capabilities, verification status, risk status and review history.
5. **SupplierEvidence** — source, evidence type, capture time, expiry/review date, market scope, reviewer and private document reference.
6. **SupplierOffer** — supplier + product + destination market; supplier SKU, source currency, unit cost, MOQ, stock/availability, fulfilment model, shipping terms and evidence.
7. **ProductMarket** — product + market; local listing content, market-specific availability, compliance state, customer price, publication state and human-approval flag.
8. **InventoryLocation / InventoryBalance** — own-stock location and quantities on hand, reserved, available and damaged. Supplier stock is not own-stock inventory.
9. **FXRate** — base/quote currency, rate, provider/source, observed time, retrieval time and status. Never overwrite historical rates used by prior calculations.
10. **MarketCostProfile** — versioned market-specific tax/duty/fee/fulfilment assumptions with source, effective dates and approval.
11. **MarketEconomics** — immutable calculation snapshot: price, currency, FX evidence, landed cost, fees, returns allowance, contribution and margin.
12. **MarketAssessment** — product + market, rating, confidence, score breakdown, reasons, evidence references, model/prompt/scoring version and timestamp.
13. **PublicationDecision** — market-scoped decision, policy version, gate results, actor (system/admin), reason, timestamp and rollback reference.
14. **ListingVersion** — generated and approved title, description, category, attributes, SEO content, locale, model version and reviewer.
15. **Customer / Address** — minimum necessary customer identity and market-specific delivery/billing addresses, with privacy and retention controls.
16. **Cart / CartItem** — customer/session, market, product-market and quantity; price snapshots must be revalidated at checkout.
17. **Order / OrderLine** — order currency, customer and address snapshots, item price snapshots, tax/fee breakdown and lifecycle.
18. **Payment / Refund** — payment-provider references, amount/currency, state and reconciliation data. Never store raw card numbers or security codes.
19. **Fulfilment / FulfilmentEvent** — own-stock or supplier-fulfilled allocation, shipment, tracking, dispatch/delivery events, exception and evidence.
20. **AuditEvent** — actor, action, entity, market, before/after summary, reason, correlation ID, timestamp and policy/model version.
21. **Integration / WebhookEvent** — external provider identity, encrypted credentials reference, event ID, signature result, processing state and idempotency key.
22. **AdminUser / Role / Permission** — identity-provider subject, role assignments, scoped permissions, MFA state and account status.

## Relational constraints

- Use UUID primary keys for internal entities.
- Use ISO 3166-1 alpha-2 market codes and ISO 4217 currency codes.
- Add unique constraints for canonical identifiers (for example product slug where globally unique, supplier + supplier SKU + market, product + market).
- Use foreign keys and explicit delete policies. Financial and audit records should be retained or anonymised under policy, not casually cascade-deleted.
- Store monetary amounts as fixed-precision decimal values, never binary floating-point. Every amount must have an associated currency.
- Store timestamps in UTC using timezone-aware database types; render using the relevant market timezone.
- Store quantities as numeric values with explicit units where fractional quantities are possible.
- Add indexes for market + status, supplier + market, product + market, order number, created time and external provider event IDs.
- Use optimistic concurrency/version columns for records where concurrent admin edits could overwrite each other.
- Record provenance for every externally sourced operational field: source, observed time, fetched time and freshness/expiry.

## Market isolation and integrity

- Every supplier offer, stock state, price, delivery estimate, compliance decision, assessment and publication decision is scoped to a destination market.
- A Nigeria offer never implies a UK offer, or vice versa.
- A product can be active in one market and held, restricted or unknown in another.
- The market and currency are visible in every admin workflow and every customer price display.
- Currency mismatches must fail validation unless an explicit FX conversion record is supplied.
- Do not use a global stock field to represent supplier stock across countries.
- Market-specific records must be created explicitly; absence is not a positive status.

## Profitability model

Convert supplier and logistics inputs to the destination currency using a timestamped FX rate and preserve the original source-currency amount. Record supplier cost, inbound shipping, customs duty, import tax, fulfilment/packaging, payment fees, platform fees, marketing cost per order, returns allowance and other variable costs.

Tax and duty treatment must be explicit, configurable, dated and supported by authoritative evidence. Do not hardcode assumed rates. Distinguish:
- gross customer price;
- taxes collected or included;
- net sales revenue;
- landed and variable costs;
- contribution and contribution margin;
- net profit only when fixed overheads and all relevant costs are included.

Every calculation is an immutable snapshot linked to the exact cost-profile and FX versions used.

## AI assessment and publication

Recommendations include score components, reasons, confidence, timestamp, evidence, freshness and model/prompt/policy versions. Do not generate a confident score from missing or stale evidence.

Initial policy defaults are 85+ for auto-publication eligibility, 65–84 for administrator review and below 65 for hold. Auto-publication is permitted only when every mandatory market-specific gate passes, including verified availability, approved compliance, verified suitable delivery, positive contribution meeting the configured minimum, at least two evidence records and no explicit human-approval requirement. A failed gate always blocks automatic publication.

High ratings can auto-publish only in the market they qualified for. Production auto-publication remains disabled until test evidence, admin controls, audit logging and rollback are verified. Admin decisions and automated decisions are auditable.

## Database implementation strategy

- PostgreSQL is the target relational database on AWS RDS, in private subnets.
- Version all schema changes as ordered SQL migrations; never edit an already-applied migration.
- Apply migrations to a disposable local/test database first, then isolated Preview/staging.
- Use separate database roles for migrations, application runtime and read-only reporting.
- The runtime application role receives only required table/sequence permissions.
- Use transactions for related order, payment and inventory state changes.
- Use an outbox or durable event pattern for cross-service side effects; do not assume a database commit and external API call are atomic.
- Test migration from an empty database and from the previous released schema.
- Back up before production migrations and document rollback/forward-fix steps.

## Current implementation boundary

The current storefront still contains static TypeScript catalogue data and has no configured production database dependency. The commerce intelligence and publication policy modules are deterministic domain logic, not a live supplier or market-data feed. No AWS database has been provisioned. The next implementation phase is to create reviewed migrations and a secure API contract before connecting admin or storefront flows to persistent records.
