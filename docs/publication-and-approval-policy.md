# Zayvi publication and approval policy

## Independent decision per destination market

Every product-market combination receives its own rating, readiness checks and publication decision. A high Nigeria rating cannot publish the product in the UK. A product may be published in one market and held or unavailable in another.

## Proposed initial rating bands

- 85–100: eligible for automatic publication in that market, but only if every mandatory gate passes.
- 65–84: administrator review and explicit approval required.
- 0–64: hold for improvement or reject; administrator can inspect the reasons.

These are initial policy defaults and should be adjustable by an authorised admin. Ratings must be explainable, evidence-backed and time-stamped.

## Mandatory gates before automatic publication

1. Supplier availability and stock have been verified for that destination market.
2. Product compliance is approved for that market.
3. Delivery estimate is verified and suitable for the market's configured delivery target.
4. Contribution is positive and meets the market's configured minimum.
5. At least two supporting evidence records are attached.
6. No restriction, safety, legal or policy block exists.
7. No explicit human-approval requirement is set for this product or market.

A high score never overrides a failed mandatory gate. A failed gate results in hold or block, not automatic publication.

## Human controls

Admins can review the rating, reasons, evidence, costs and delivery assumptions. Admin approval, rejection and overrides must be recorded with actor, timestamp, market, reason and policy version. Automatic publication should also create an audit event.

## Rating design

The eventual score should be a weighted, explainable assessment of:
- supplier quality and verified availability;
- landed cost and contribution margin;
- delivery speed and delivery reliability;
- market demand and competition;
- returns and product-quality risk;
- regulatory/compliance readiness;
- evidence freshness and confidence.

Do not generate a rating from missing data. Missing or stale evidence must reduce confidence and may fail a publication gate.

## Initial defaults in code

The initial policy module uses 85 as the auto-publication threshold and 65 as the lower review band boundary. The score bands do not replace mandatory gates. These defaults are a starting configuration for testing, not a claim that any product is currently approved for publication.
