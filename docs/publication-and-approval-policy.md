# Zayvi publication and approval policy

## Independent decision per destination market

Every product-market combination receives its own rating, readiness checks and publication decision. A high Nigeria rating cannot publish the product in the UK. A product may be published in one market and held, restricted or unknown in another.

## Initial rating bands

- **85–100:** eligible for automatic publication in that market, but only when every mandatory gate passes and the market's auto-publication switch is enabled.
- **65–84:** administrator review and explicit approval required.
- **0–64:** hold for improvement or reject; an administrator can inspect the reasons.

These are initial policy defaults, configurable only by an authorised owner/admin. Ratings must be explainable, evidence-backed, time-stamped and versioned. The score is not a guarantee of sales or product quality.

## Mandatory gates before automatic publication

1. Supplier identity and offer are verified for that destination market.
2. Supplier availability and stock have been checked recently enough for the market's configured freshness limit.
3. Product compliance is approved for that market, with evidence and reviewer.
4. Delivery estimate is verified and suitable for the market's configured delivery target.
5. Contribution is positive and meets the market's configured minimum.
6. At least two independent supporting evidence records are attached and current.
7. No restriction, safety, legal, rights or policy block exists.
8. No explicit human-approval requirement is set for this product, supplier or market.
9. The global and market-specific auto-publication controls are enabled.
10. The assessment and policy versions are supported for production use.

A high score never overrides a failed mandatory gate. A failed gate results in hold or block, not automatic publication.

## Approval model

The founder's approved operating model is:

- AI assesses and rates each product independently for each destination market.
- High-rated products may publish automatically only in the market where all gates pass.
- Medium and low ratings require administrator review; low ratings are held unless an authorised admin explicitly resolves the issue.
- An administrator can approve, reject, request more evidence or override a recommendation with a recorded reason.
- Supplier onboarding/verification, market compliance approval, material price changes and exceptional risk decisions remain controlled workflows; a product rating does not silently approve these.
- Production automatic publication remains disabled until the complete test and rollback criteria are met.

## Emergency and rollback controls

Provide a global kill switch and independent per-market switches. Admins must be able to unpublish/withdraw a listing quickly. The system records the prior state, actor, reason, timestamp and affected market. A rollback must not delete the audit trail or order history.

## Admin review information

Show the rating, confidence, component scores, plain-language reasons, supplier identity and verification, market stock and last checked time, landed-cost breakdown, FX source/time, delivery evidence and type, compliance evidence, evidence freshness, gate results, model/prompt/scoring version and proposed action.

## Rating design

The eventual score should be a weighted, explainable assessment of:
- supplier quality and verified availability;
- landed cost and contribution margin;
- delivery speed and delivery reliability;
- market demand and competition;
- returns and product-quality risk;
- regulatory/compliance readiness;
- evidence freshness and confidence.

Do not generate a confident rating from missing data. Missing or stale evidence must reduce confidence and may fail a publication gate. Scores and thresholds must be calibrated against observed outcomes before production automation is enabled.

## Audit requirements

Record every automated assessment, automatic publication, admin approval/rejection/override, threshold change, switch change, withdrawal and rollback. Audit records include actor type/ID, action, product, market, before/after state, reason, timestamp, model/scoring version and policy version. Do not log secrets or unnecessary personal data.

## Initial code boundary

The current policy module implements deterministic threshold and gate decisions. It is not connected to a live supplier feed, compliance authority, delivery service or production database. The defaults are test configuration, not evidence that any product is approved or that auto-publication is active.
