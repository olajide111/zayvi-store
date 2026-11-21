# Zayvi remaining work packages

These are proposed assignments, not claims that other models are currently working. Use separate branches and reviewed interface contracts. Current changes are local and require Preview deployment; migration 0029 is unapplied here.

| Owner/model | Work package | Completion evidence |
| --- | --- | --- |
| GPT-6.2 Astra | Seller registration and tenancy: identity, store provisioning, membership roles, sessions, account recovery | Cross-tenant access tests; new seller can resume setup on another device |
| GPT-6.2 Sol | Theme lifecycle: immutable server drafts, selected appearance, preview, publish, rollback, release events | Reload/cross-device persistence, concurrent edit protection, publish/rollback tests, unauthorized premium publishing blocked |
| Claude team | Theme renderer integration: real catalogue, variants, media, stock, market prices, merchant content/navigation/social profiles | All 30 themes pass the same real-data acceptance suite without demo fallbacks |
| GPT-6.2 Astra | Discovery and scoring after setup/theme gate: source provenance, supplier connectors/jobs, deduplication, evidence-based ranking and optional AI explanations | Repeatable imports, source timestamps, explicit missing-data/confidence, evaluated ranking and human review; no auto-publication |
| GPT-6.2 Sol | Merchant dashboard: resumable onboarding, actual readiness checks, error/retry states, contextual links | No false completion indicators; workflows exercised against Preview APIs |
| GPT-6.1 Terra | Visual and accessibility QA on phone/tablet/desktop | Screenshots and interaction evidence for all themes; keyboard and reduced-motion checks |
| GPT-6.2 Astra | Billing and permissions before launch: seller plans, theme entitlements, downgrade/revocation, webhook idempotency | Server enforcement on draft/publish/render and audited billing lifecycle |
| GPT-6.2 Sol | Release engineering: migration review, environment separation, restore drill, CI, monitoring, deployment/runbooks | Reviewed Preview plan, recovery evidence, API and UI smoke checks; separate production release |
| User and payment integration owner | Live payment/provider approval and business launch decisions, deferred until pre-launch | Separate live credentials and webhooks, pricing/tax/delivery/policy decisions and signed go-live checklist |

## Sequence

1. Complete seller identity plus server theme lifecycle and real-data renderer integration.
2. Verify onboarding and theme setup end to end in Preview, including appearance and rollback.
3. Complete discovery research and scoring on the existing review-first supplier pipeline.
4. Finish billing, QA, operations and pre-launch payment work.

Freeze shared API/config contracts before parallel edits. One owner integrates each shared route or schema change. A build pass alone is not an end-to-end acceptance result. No completion date is committed.
