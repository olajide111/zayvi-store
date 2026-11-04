# Zayvi target architecture

**Status:** Proposed architecture for the official rebuild  
**Decision scope:** Application, data, security and deployment boundaries  
**Region:** AWS Europe (London), eu-west-2, unless a documented legal or latency requirement justifies another region

## Product principle

Zayvi is a multi-market commerce operating system with a customer storefront and an internal commerce operations platform. The UK and Nigeria are the first configured markets, not architectural limits.

## Logical architecture

```text
Customers / Administrators
          |
          v
Next.js storefront and admin UI (Vercel)
          |
          | HTTPS, short-lived identity tokens
          v
AWS API Gateway (public API boundary)
          |
          v
AWS Lambda application services (private VPC access)
          |
          +------> Amazon RDS for PostgreSQL (private subnets)
          |
          +------> S3 private object storage
          |
          +------> SQS / EventBridge for asynchronous jobs
          |
          +------> CloudWatch logs, metrics and alarms

Images and public approved media:
Private S3 origin -> CloudFront -> browser
```

## Recommended service responsibilities

- **Vercel / Next.js:** customer-facing storefront, server-rendered pages, admin user interface and Preview deployments. It must not contain database credentials or connect directly to a publicly exposed database.
- **API Gateway:** authenticated, rate-limited HTTPS entry point for commerce APIs.
- **AWS Lambda:** business logic for catalogue, suppliers, offers, market assessments, pricing, orders, fulfilment and administration. Separate modules by domain; do not create one oversized handler.
- **Amazon RDS for PostgreSQL:** authoritative transactional data. Use private subnets, encryption at rest, automated backups and least-privilege database roles.
- **RDS Proxy:** introduce when connection volume/concurrency justifies it; it is not a prerequisite for the first schema migration.
- **Amazon S3:** private product originals, supplier evidence and documents. CloudFront should expose only approved public media paths; private evidence must use authenticated or short-lived access.
- **SQS and EventBridge:** background supplier sync, stock refresh, assessment jobs, notifications and retryable workflows. Jobs must be idempotent.
- **CloudWatch:** structured logs, dashboards, alarms and operational visibility.
- **AWS Secrets Manager / Parameter Store:** server-side secrets and non-secret configuration. Never put secrets in source control or browser bundles.
- **Identity:** use a managed OIDC-compatible identity provider for administrators and customers. Enforce MFA for privileged roles. The existing single shared admin password is a temporary bootstrap only and must not become the production identity model.

## Why this boundary

Vercel is well suited to the Next.js experience, while AWS owns the commerce data plane and private database. API Gateway and Lambda provide a controlled boundary without exposing PostgreSQL to the public internet. This also allows mobile apps, partner integrations and future channels to use the same API.

## Data and market isolation

Every supplier offer, stock state, price, delivery estimate, compliance decision, assessment and publication decision is scoped to a destination market. The absence of a product-market record means **unknown / not assessed**, never available. GBP and NGN values are never added or compared without an explicit, timestamped FX conversion.

## Environments

- **Local:** synthetic/test data only; no production credentials.
- **Preview / staging:** isolated database and storage prefixes; test payment credentials; seeded test users.
- **Production:** separate resources, secrets, backups, payment credentials and access roles. Production deployment requires explicit release approval.

Do not point Preview deployments at production customer or order data.

## Reliability and security requirements

1. Database and evidence storage are not publicly writable.
2. All external APIs use TLS; all secrets are stored outside Git.
3. Admin actions require role-based authorisation and are audited.
4. Payment card data is handled by a PCI-compliant payment provider; Zayvi stores provider references, not raw card details.
5. Supplier webhooks and background jobs verify signatures where supported and are idempotent.
6. Apply request validation, rate limits, pagination and safe error responses.
7. Encrypt backups and test restoration.
8. Monitor API error rates, latency, failed jobs, payment webhooks and database capacity.
9. Define retention and deletion rules for customer personal data.
10. Keep an incident runbook and rollback procedure.

## Cost and provisioning guardrail

This document is an architecture decision, not permission to create billable AWS resources. Before provisioning, present a service-by-service configuration, expected monthly cost range, backup/retention assumptions and teardown procedure for approval. Start with the smallest production-sensible footprint and scale based on measured traffic.

## Decisions still requiring validation

- Final identity provider and role model.
- Exact RDS instance class, storage, backup retention and availability configuration.
- API Gateway HTTP API versus REST API after reviewing required controls.
- Lambda runtime and packaging approach.
- Whether RDS Proxy is needed at launch.
- Data residency, privacy and tax obligations for each market.
- Payment providers and supported countries/currencies.
