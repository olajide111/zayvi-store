# Zayvi Strategic Product and Commercial Blueprint

**Status:** Approved product direction for the official rebuild  
**Scope:** Product strategy, multi-tenant architecture, commercial model and investor validation  
**Initial markets:** United Kingdom (GB, GBP) and Nigeria (NG, NGN)  
**Implementation status:** Strategy and architecture decision; features described here are not represented as already implemented.

## 1. Strategic direction

Zayvi is an AI-driven global commerce intelligence and operations platform. It combines a commerce operating business with reusable software and intelligence products.

The platform is organised into three commercial divisions:

1. **Zayvi Commerce** — Zayvi-operated storefront, physical products, wholesale/sourcing and fulfilment coordination.
2. **Zayvi Intelligence** — product, supplier and market intelligence, profitability analysis, demand forecasting, research and APIs.
3. **Zayvi Enterprise** — white-label stores, multi-tenant commerce infrastructure, integrations and managed enterprise services.

The divisions share a common platform, identity, catalogue, supplier network, market configuration, intelligence services and operational controls. They are not three disconnected technology stacks.

## 2. Customer groups and jobs to be done

| Customer | Problem | Zayvi value |
|---|---|---|
| Independent retailer | Needs a store, products and reliable operations | Branded store, catalogue, supplier and fulfilment tools |
| Online seller / dropshipper | Product selection and supplier decisions are fragmented | Market-specific opportunity scoring and supplier evidence |
| Established retailer | Needs to expand to new countries | Localised economics, market controls and cross-border operations |
| Wholesaler / supplier | Wants qualified retailer demand and better distribution | Supplier profile, offers, quotation and order integrations |
| Developer / software platform | Needs commerce intelligence inside another product | Versioned API and SDK |
| Enterprise / multi-brand operator | Needs central governance across stores and markets | Tenant-aware platform, role controls, reporting and integrations |

## 3. Product portfolio

### Zayvi Commerce
- Zayvi-operated storefront and product catalogue.
- Own-stock and approved supplier-fulfilled offers.
- Wholesale sourcing and supplier discovery.
- Order, inventory, returns and fulfilment coordination.
- Market-specific storefront experience and pricing.

### Zayvi Intelligence
- Product discovery and product-market opportunity assessment.
- Supplier evidence and reliability intelligence.
- Landed-cost and contribution calculations.
- Demand and category analytics.
- Trade and market research reports.
- Product enrichment, classification and recommendation APIs.

### Zayvi Enterprise
- White-label storefronts with customer branding and custom domains.
- Multi-store and multi-market management.
- Tenant-specific catalogues, users, roles, policies and integrations.
- API and SDK access with usage limits and audit records.
- Enterprise reporting, support and integration services.

Digital downloads, training and research publications can be offered as additional catalogue types, but they should not distract from the core platform until the primary commerce and intelligence workflows are validated.

## 4. Multi-tenant architecture decision

Zayvi must be designed as a multi-tenant platform from the data and API foundations, even though the first tenant may be Zayvi itself.

### Core concepts
- **Tenant:** a business or organisation subscribing to or operating on Zayvi.
- **Store:** a branded selling experience owned by a tenant.
- **Market:** a destination country/market with its own currency, locale, compliance, tax and delivery configuration.
- **Membership:** a user's relationship to a tenant and their role.
- **Entitlement:** a feature, usage allowance or service enabled by a plan or contract.
- **Integration:** a tenant-authorised connection to a supplier, payment provider, marketplace or logistics service.

### Isolation rules
1. Every tenant-owned record must be scoped to a tenant, directly or through a parent with enforced ownership.
2. Every request must resolve and authorise the tenant from a trusted server-side identity/context; never trust a browser-supplied tenant ID alone.
3. Database access must enforce tenant boundaries, preferably with PostgreSQL row-level security as defence in depth, plus application-level authorisation.
4. Cross-tenant reads and writes must be denied by default and tested.
5. Platform operators require explicit, audited support access; no silent cross-tenant browsing.
6. Tenant data exports, deletion, retention and backup handling must be documented.
7. Shared global reference data (e.g. market registry and public taxonomy) must be distinguished from tenant-owned data.
8. Zayvi-owned commerce can be represented as a first-party tenant, using the same domain model as external tenants.

### White-label requirements
- Tenant branding, logo, colours, domain and locale.
- Store-level catalogue selection and market configuration.
- Tenant-specific legal identity, policies and customer communications.
- Independent admin users, roles and permissions.
- Tenant-level pricing, feature entitlements and usage metering.
- Domain verification and secure certificate management.
- Clear ownership of customer, order and supplier data.
- Platform-wide security, moderation and compliance controls that tenants cannot bypass.

## 5. Commercial model

The following are proposed revenue mechanisms, not approved prices or proven revenue.

| Revenue stream | Potential charging basis |
|---|---|
| Physical commerce | Product contribution margin |
| White-label store | Setup/onboarding fee plus recurring subscription |
| Intelligence workspace | Subscription tiers and research credits |
| API / SDK | Metered calls, volume tiers and enterprise contract |
| Supplier network | Supplier subscription, qualified lead or transaction fee |
| Research reports | Per-report purchase or research membership |
| Fulfilment coordination | Per-order or contracted service fee |
| Enterprise | Annual platform licence, onboarding and integration services |

Avoid charging two parties for the same value without transparent disclosure. Supplier placement, paid promotion and rankings must be labelled and must not manipulate independent quality or viability scores.

### Packaging principles
- **Starter:** one store, core catalogue and basic commerce operations.
- **Growth:** multiple markets, supplier tools, intelligence allowance and automation.
- **Business:** multi-store, advanced reporting, integrations and staff roles.
- **Enterprise:** custom controls, API capacity, integrations, service levels and negotiated terms.

Exact prices, limits and feature entitlements require customer research and unit-economics validation. Plans should be configurable rather than embedded throughout the application.

## 6. Shared platform capabilities

- Identity, authentication, tenant membership and role-based access.
- Store and domain configuration.
- Canonical product catalogue and media rights records.
- Supplier profiles, offers and evidence.
- Market registry, currencies, FX evidence and cost profiles.
- Market-specific product availability and compliance.
- Versioned financial calculations and AI assessments.
- Publication policy, approvals, audit and emergency controls.
- Inventory, orders, payments, refunds and fulfilment.
- API keys/OAuth clients, rate limits, usage metering and webhooks.
- Subscription, billing and entitlement services.
- Observability, security monitoring and support tooling.

## 7. Intelligence and data strategy

Use the right method for each task rather than training one general model for everything.

| Capability | Initial method | Required outcome data |
|---|---|---|
| Product classification and enrichment | Rules, taxonomy, embeddings and LLM-assisted extraction | Reviewed product attributes and correction history |
| Market viability | Deterministic economics plus calibrated tabular model when labels exist | Actual margin, conversion, sales and market outcomes |
| Demand forecasting | Baselines, gradient boosting and time-series models | Dated sales/stock/price history |
| Supplier reliability | Evidence rules initially; predictive model after sufficient observations | Dispatch, delivery, cancellation, defect and return outcomes |
| Fulfilment selection | Cost/ETA rules and ranking; predictive models as data matures | Quotes and actual fulfilment performance |
| Review intelligence | NLP classification and aspect extraction | Licensed reviews and human quality checks |

### Data governance
Every dataset must have a registry entry covering owner/source, licence, permitted purpose, commercial-use status, collection date, geography, fields, retention, personal-data assessment, transformations and quality checks.

Separate raw, cleaned, feature and training datasets. Keep dataset versions, reproducible training code, evaluation reports and model cards. Public availability does not automatically grant commercial training rights. Synthetic data is for software tests and pipeline development, not evidence of real demand or supplier performance.

### Model quality
- Compare models with simple baselines.
- Use time-based and market-aware train/validation/test splits.
- Prevent leakage between the same product, supplier or time period where appropriate.
- Report calibration, precision/recall, error and confidence, not just one accuracy score.
- Monitor drift and segment performance by market and category.
- Do not claim model accuracy until measured on representative, permitted data.
- Keep deterministic price, tax and contribution calculations outside LLM-generated text.

## 8. Security, privacy and compliance

- Tenant isolation enforced in API and database.
- MFA for privileged roles and least-privilege permissions.
- Encryption in transit and at rest; secrets stored in managed secret services.
- Audit trails for access, exports, approvals, pricing and publication.
- Data minimisation, retention schedules and deletion/export procedures.
- Supplier documents and private evidence remain private; only authorised media is publicly delivered.
- Payment card data handled by compliant payment providers; do not store raw card details.
- Market-specific legal and regulatory review before enabling a product or service.
- Security testing must include cross-tenant access attempts and privilege escalation cases.

## 9. Phased execution

### Phase 0 — Strategy and architecture
- Approve this product portfolio and multi-tenant decision.
- Finalise tenant/store/market identity and access model.
- Map existing code and data model against the target architecture.
- Confirm service costs and operational ownership before provisioning paid AWS resources.

### Phase 1 — Shared foundation
- PostgreSQL schema and migrations for tenants, stores, memberships, roles and entitlements.
- Authentication and server-side tenant resolution.
- Tenant-scoped catalogue and supplier records.
- Audit events and automated isolation tests.
- First-party Zayvi store represented as a tenant.

### Phase 2 — Zayvi first-party commerce
- Product-market records, evidence, economics and assessment.
- Admin review and publication controls.
- Inventory, orders and fulfilment foundations.
- Validate the end-to-end workflow with a small, real, authorised catalogue.

### Phase 3 — White-label pilot
- Tenant onboarding and store creation.
- Branding and custom-domain workflow.
- Tenant-specific catalogue, staff and market settings.
- Subscription entitlements and usage measurement.
- Pilot with a small number of external businesses under controlled support.

### Phase 4 — Intelligence products
- Product-market research workspace.
- Evidence-backed assessments and reports.
- API authentication, quotas, versioning and usage billing.
- Model training only where data rights and sufficient labels exist.

### Phase 5 — Enterprise expansion
- Multi-store controls, integrations and advanced reporting.
- Supplier and logistics partner network.
- Enterprise security reviews, service levels and support processes.
- Expansion to additional markets based on validated demand and compliance.

## 10. Investor evidence and validation

Do not present market size, traction, accuracy, supplier coverage or revenue projections as facts without sources and methodology.

Build an evidence room containing:
- Competitor capability matrix and dated source links.
- Customer interviews and willingness-to-pay findings.
- Dataset licence register and data provenance.
- Pilot results and baseline comparisons.
- Actual versus predicted contribution margin.
- Supplier verification and fulfilment outcomes.
- Activation, retention, gross margin and customer acquisition economics.
- Security, privacy and architecture documentation.
- Product roadmap, risks and milestone-based budget.

### Initial validation experiments
1. Interview independent retailers in the UK and Nigeria about product selection, supplier and cross-border operating pain.
2. Test whether customers will pay for a white-label store before building a large self-service builder.
3. Test whether a market viability report changes a retailer's product or market decision.
4. Run a small catalogue through the full evidence, cost and approval workflow.
5. Compare predicted costs and margins with actual quotations and pilot orders.
6. Measure onboarding time, time to first published listing and support effort.

## 11. Decisions and non-goals

Approved direction:
- One shared platform with three divisions: Commerce, Intelligence and Enterprise.
- Multi-tenant foundations from the beginning.
- Zayvi's own store is the first-party tenant.
- UK and Nigeria are initial markets, not hard-coded limits.
- White-label stores, intelligence subscriptions and API/enterprise licensing are target products.
- Human-controlled publication and market-specific decisions remain in force.

Not yet approved or proven:
- Final subscription prices and take rates.
- Any guaranteed supplier network or delivery coverage.
- Automated tax/legal advice.
- Production AI auto-publication before validation.
- Paid AWS database/backend provisioning.
- Production launch, customer onboarding or investor performance claims.

## 12. Definition of done for multi-tenant foundations

- Tenant, store, membership, role and entitlement schema exists with migrations.
- Every tenant-owned API path authorises the tenant server-side.
- Automated tests prove tenant A cannot read or mutate tenant B data.
- Admin support access is explicit and audited.
- Store branding and market settings are tenant/store scoped.
- Entitlements are enforced server-side.
- Audit events cover privileged changes and sensitive data access.
- Documentation and operational runbooks are complete.
- Preview build and automated tests pass before any production release.
