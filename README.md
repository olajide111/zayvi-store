# Zayvi Store

Zayvi is being rebuilt as an AI-powered, multi-market commerce operating system. It supports a hybrid fulfilment model: Zayvi-owned inventory and approved supplier-fulfilled offers. The initial markets are the United Kingdom (GBP) and Nigeria (NGN), with an extensible market model.

> **Rebuild status:** foundational commerce types and market publication policy are implemented. The latest Vercel Preview build passed. The database/API and full admin operations console are still under development. This repository is not yet production-ready.

## Product principles

1. A product's global identity is separate from its offer and eligibility in each destination market.
2. Missing market data means unknown/not assessed, never available.
3. Supplier, stock, delivery, compliance, FX and profitability claims require dated evidence.
4. All monetary calculations use explicit currencies and timestamped FX evidence.
5. AI recommendations are explainable, confidence-aware and auditable.
6. A high AI rating cannot override a failed safety, compliance, delivery, evidence or contribution gate.
7. Customer-facing production changes require testing and release approval.

## Repository guide

- `app/` — Next.js application routes and user interface.
- `lib/` — shared application and domain logic.
- `docs/global-commerce-data-model.md` — canonical commerce entities and market-isolation rules.
- `docs/publication-and-approval-policy.md` — rating bands, mandatory gates and human controls.
- `docs/` — architecture, operations, security and runbooks (being expanded).

## Current technology

- Next.js 16 and React 19 for the web application.
- Vercel for Preview deployments and web delivery.
- AWS S3 and CloudFront for private-origin media delivery.
- AWS is the selected direction for the commerce database and backend. The intended design is a private Amazon RDS for PostgreSQL database behind authenticated AWS API services; no database is provisioned yet.

## Local development

Requirements: the Node.js version supported by the current Vercel project and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Before submitting a change:

```bash
npm run lint
npm run build
```

Run the relevant automated tests as they are added. Do not use production secrets or real customer data locally.

## Environments and release safety

- Work on the agreed feature branch and verify changes in Vercel Preview.
- Preview must use test credentials and isolated non-production data.
- Do not merge to the production branch or deploy to Production without explicit approval.
- New Vercel environment variables require a new deployment before they take effect.
- Never commit credentials, tokens, private keys, customer exports or supplier secrets.

## Market model

The initial market registry includes:

| Market | Country | Currency | Locale |
|---|---|---|---|
| GB | United Kingdom | GBP | en-GB |
| NG | Nigeria | NGN | en-NG |

A product can be viable in one market and unavailable or unassessed in another. Do not infer cross-market availability, prices, supplier offers or compliance.

## AI publication policy

Initial configurable defaults:

- 85–100: eligible for auto-publication only when every hard gate passes.
- 65–84: administrator review.
- 0–64: hold.

Hard gates include verified market-specific availability, approved compliance, verified suitable delivery, positive contribution meeting the market minimum, at least two evidence records and no explicit human-approval requirement. A failed gate blocks automatic publication. Production auto-publication remains disabled until the scoring pipeline and controls have passed the release test plan.

## Security and data handling

- Keep database and supplier evidence private.
- Use role-based access and MFA for privileged users.
- Store secrets in managed secret storage, never in Git or browser code.
- Store timestamps in UTC and render in the relevant market timezone.
- Use idempotency for payment, supplier and fulfilment events.
- Do not store raw payment card data.
- Audit sensitive administrative and automated decisions.

## Documentation and change control

Architecture decisions, schema migrations, API contracts, scoring changes, policy thresholds, security exceptions and operational procedures must be documented and reviewed. Keep documentation aligned with the implementation; do not describe a planned service as deployed.

## Important links

- [Global commerce data model](docs/global-commerce-data-model.md)
- [Publication and approval policy](docs/publication-and-approval-policy.md)
- [Vercel project](https://vercel.com/olajide111s-projects/zayvi-store)

## Commercial product direction

Zayvi is being designed as one shared, multi-tenant platform with three commercial divisions:

- **Zayvi Commerce** — first-party retail, wholesale/sourcing and fulfilment coordination.
- **Zayvi Intelligence** — product, supplier and market intelligence, profitability analysis, research and APIs.
- **Zayvi Enterprise** — white-label stores, multi-store operations, integrations and enterprise services.

The architecture must support external business tenants from the foundation. Zayvi's own storefront is the first-party tenant; each external business must have isolated users, stores, catalogue, customer/order data, settings and entitlements. Tenant isolation is enforced server-side and tested. This is a target architecture, not a claim that multi-tenancy is already implemented.

See `docs/strategy/zayvi-strategic-product-commercial-blueprint.md` for the approved product portfolio, commercial model, tenant architecture, data strategy, phased roadmap and investor validation plan.
