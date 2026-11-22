# Hammy sales-growth implementation order

This is the agreed development sequence, not evidence that the features are connected or enabled. Hammy currently uses sample products and a browser-session basket. No recovery messages, offers, real checkout or fulfilment are activated by this plan.

## 1. Store identity and access — next foundation

Resolve Hammy's immutable tenant/store context from authenticated ownership on the server. A storefront name or browser-provided store ID is not authorization. Verify reads and writes reject another store's context, and avoid silently routing Hammy to the existing main-store records. Establish test fixtures for two stores and prove owner isolation before wiring business data.

## 2. Real catalogue and checkout

Connect real variant SKUs, authoritative market prices, inventory, order creation and the correct store payment connection. Include explicit delivery/returns policies and basic customer-support contact before selling. Verify paid, failed, cancelled and refunded test orders, signed payment events and replay handling. Keep Preview/test fulfilment blocked. Add server-confirmed funnel events here so later recovery metrics are meaningful.

## 3. Abandoned-cart recovery

Persist store-scoped cart/checkout state, contact preferences and completion events. Use expiring recovery links and revalidate current prices and stock. Suppress reminders when paid, opted out or otherwise ineligible. Verify idempotent delivery records and provider configuration before any messaging is enabled. Browser-only anonymous carts cannot establish a contact channel.

## 4. Bundles and offers

Configure explicit component SKUs and quantities, server-calculated discounts and inventory checks. Define discount allocation for partial returns/refunds and test conflicting promotions. Do not treat a decorative bundle card as a priced/reservable bundle.

## 5. Customer-care automation

Extend the basic launch support with shipment updates, store/customer-scoped order lookup, service cases, return updates and satisfaction follow-up. Measure response times, verified return outcomes and repeat purchases. Marketing and service messaging need distinct configuration and appropriate customer preferences.

## Shopping interaction rules

- Collection cards open quick view without changing collection URLs, filters or scroll context.
- Quick view offers available specifications, sample size/colour choices and a full-product link. Do not invent missing materials or measurements.
- A successful add updates the local basket, closes quick view and shows a non-modal confirmation. It never opens a basket drawer or cart page automatically.
- Basket review is explicit. Reduced-motion preferences are respected, and failed validation never produces success feedback.
- Keep the saved Store Templates v1 shopping implementation separate. Photo enhancements remain deferred.
