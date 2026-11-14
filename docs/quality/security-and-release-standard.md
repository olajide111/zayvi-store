# Zayvi engineering quality, security and release standard

## Definition of done

A feature is not complete because it compiles or looks correct. It is complete only when its behaviour, permissions, failure handling, tests, documentation and operational ownership are covered.

## Required engineering practices

- TypeScript strictness and explicit domain types.
- Runtime validation at API boundaries; never trust browser input.
- Domain logic separated from UI components and transport handlers.
- Database migrations versioned, reviewed and reversible where possible.
- No secrets, real customer data or production exports in Git.
- No silent fallback to fabricated stock, prices, suppliers or delivery estimates.
- All money values carry a currency; conversions carry FX source and timestamp.
- All timestamps are stored in UTC and rendered in the user's market timezone.
- Use idempotency keys for payment, supplier and fulfilment operations.
- Use correlation IDs across API requests and background jobs.
- Structured logs must exclude secrets and unnecessary personal data.

## Test layers

1. **Unit tests:** calculations, validation, market rules, publication policy and state transitions.
2. **Integration tests:** database repositories, API authentication/authorisation, supplier adapters and payment webhooks.
3. **Contract tests:** supplier/payment payloads and versioned internal API schemas.
4. **End-to-end tests:** browse, market selection, checkout, order lifecycle, admin review and fulfilment exception handling.
5. **Security tests:** access control, injection, CSRF where applicable, rate limiting, upload validation, secret leakage and dependency vulnerabilities.
6. **Operational tests:** backup restoration, alert delivery, job retry, duplicate webhook and rollback.

## Critical test cases

- A UK offer never creates Nigerian availability, or vice versa.
- Missing market records render as unknown/not assessed.
- Currency mismatches are rejected unless an explicit conversion is supplied.
- Expired supplier stock evidence blocks automatic publication.
- A high rating cannot bypass a failed compliance, delivery, contribution or evidence gate.
- Admin review is required for medium ratings and explicit human-approval flags.
- Duplicate webhooks do not duplicate orders, charges or fulfilment.
- A suspended administrator cannot use an old session to perform privileged actions.
- Private supplier evidence is never served through public CloudFront paths.
- Failed background jobs retry safely and become visible to operations.

## Security baseline

- MFA for privileged users.
- Role-based access control and least privilege.
- Secure, HttpOnly, SameSite cookies for browser sessions where cookies are used.
- Short-lived tokens and server-side secret storage.
- TLS in transit and encryption at rest.
- Private database networking and restricted security groups.
- Validated file type, size and content for uploads; random object keys.
- Rate limits and abuse protection for authentication, search and checkout.
- Dependency scanning and prompt patching of critical vulnerabilities.
- Data minimisation, retention schedules and privacy request procedures.
- Security incident response and credential rotation runbook.

## Release process

1. Create a focused feature branch from the agreed integration branch.
2. Record scope and acceptance criteria in an issue or change note.
3. Implement with tests and documentation.
4. Run lint, type checking, unit/integration tests and production build.
5. Deploy to Vercel Preview and isolated AWS staging resources.
6. Verify critical user journeys and inspect logs/metrics.
7. Obtain product-owner approval for changes affecting customers, money, publication or production data.
8. Merge only after review and green checks.
9. Production deployment requires explicit release approval.
10. Verify health checks and key journeys; keep a rollback path.

## Environments and data

Preview must use synthetic data and test payment credentials. Production data must never be copied into local or Preview environments unless a formally approved, anonymised process exists. Separate credentials, databases, buckets/prefixes and webhook endpoints by environment.

## Operational readiness

Before launch, document service ownership, dashboards, alert thresholds, support escalation, supplier outage procedures, payment incident procedures, backup restoration, data deletion and deployment rollback. Establish measurable service objectives after baseline traffic is observed rather than inventing uptime claims.

## Change control

Architecture decisions, API contracts, schema changes, security exceptions and publication policy changes must be recorded. Changes to AI prompts, model versions, scoring weights or thresholds must be versioned and auditable.
