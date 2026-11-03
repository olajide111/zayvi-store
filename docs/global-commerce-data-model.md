# Zayvi global commerce data model

## Core rule
A product is a global identity. Availability, supplier offers, pricing, compliance, delivery and profitability are separate for each destination market. A missing market record means unknown/not assessed, never available.

## Initial markets
- GB: United Kingdom, GBP, en-GB
- NG: Nigeria, NGN, en-NG

The market registry must remain extensible. Currency and locale are market configuration.

## Records
1. Product: canonical product identity, category, attributes and media.
2. Supplier: verified business identity, locations and capabilities.
3. SupplierOffer: supplier, product and destination market; source currency, cost, stock, MOQ, fulfilment model, shipping, delivery window and evidence.
4. ProductMarket: market-specific enabled/listed state, availability, compliance, local content and customer price.
5. MarketEconomics: dated calculation with destination-currency inputs and explicit FX evidence.
6. MarketAssessment: recommendation, reasons, confidence, timestamp and evidence references.
7. FulfilmentEvent: dispatch/delivery events used to compare quoted and observed delivery.

## Market availability
Use explicit states: available, limited_stock, temporarily_unavailable, not_listed, restricted, verification_required. A Nigeria offer never implies a UK offer, or vice versa. The same product may have different suppliers, stock, delivery times and costs in each market.

## Profitability inputs
Convert inputs to the destination market currency using an FX rate with source and observation timestamp. Record supplier cost, inbound shipping, customs duty, import tax, fulfilment/packaging, payment fees, platform fees, marketing cost per order and returns allowance. Tax and duty treatment must be explicit and configurable; never hardcode assumed rates. Label the result contribution estimate, not net profit, unless fixed overheads are included.

## AI and approval
Recommendations must include evidence, timestamp, confidence and reasons. Missing/stale stock, missing delivery evidence, unapproved compliance or incomplete costs must reduce readiness. AI can prepare recommendations and draft listings; human approval is required before publication, supplier selection and material price changes.

## Current implementation boundary
The current storefront uses a static TypeScript catalogue and has no configured database dependency. This document defines the intended domain model; it is not a live supplier database. Persistent operational records require a database decision and migration.
