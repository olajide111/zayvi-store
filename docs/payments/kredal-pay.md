# Kredal Pay integration for Zayvi

## Decision

Zayvi integrates with **Kredal Pay as a payment platform**. Zayvi does not integrate directly with Paystack when Kredal is intended to own Nigerian provider selection and fallback.

The boundary is:

```text
Zayvi storefront
      |
      v
Zayvi AWS commerce API
      |
      v
Kredal Pay API
      |
      +--> Paystack
      +--> licensed bank/provider partners
      +--> future rails
```

Zayvi owns carts, orders, fulfilment eligibility and customer order state. Kredal owns its hosted payment experience, underlying provider routing, transfer/USSD/card rails, payment status and refund execution.

## Current release state

Payment execution remains **disabled in Preview**. This is intentional. The current branch may create replay-safe draft orders and persist payment-platform metadata, but it must not charge real customers.

Kredal is currently treated as an NGN platform integration. Zayvi must not derive NGN prices from GBP using an implicit or stale exchange rate. Nigeria products need explicit server-side market pricing before NGN checkout is enabled.

## Store connection model

Each Zayvi seller/store connects its own Kredal business. Zayvi persists:

- Zayvi tenant and store IDs;
- Kredal connection ID (`kc_...`);
- connection state: `pending`, `active` or `revoked`;
- approval/revocation timestamps;
- non-secret connection metadata.

Platform keys and webhook secrets are server-side secrets and must never be stored in browser code or committed to Git.

## Payment-attempt ledger

`commerce_payment_attempts` supports:

- `paypal`
- `square`
- `kredal`

A payment attempt always belongs to an existing Zayvi order. Zayvi's order number should be sent to Kredal as the merchant reference. Provider callbacks must never be sufficient on their own to permit fulfilment.

## Live flow target

1. Server validates the market and prices the cart from PostgreSQL.
2. Zayvi creates an idempotent order.
3. The order moves to `pending_payment`.
4. Zayvi creates a Kredal payment attempt using the stored order total.
5. The buyer is sent to Kredal hosted checkout.
6. Kredal sends a signed webhook.
7. Zayvi verifies the event and, when needed, verifies the payment through Kredal's API.
8. The payment attempt becomes captured/paid.
9. The Zayvi order becomes paid/confirmed.
10. Only then may fulfilment begin.

## Security requirements

- Verify `X-Kredal-Signature` against the raw webhook body.
- Reject stale webhook timestamps.
- Store/process each external event once.
- Expect duplicate and out-of-order webhook delivery.
- Never let a late paid event undo a later refund state.
- Keep Kredal platform keys and webhook secrets outside Vercel browser-visible variables.
- Never ship on a test-mode transaction.
- Never allow the browser to set the authoritative amount or currency.

## Go-live gates

Kredal checkout remains disabled until all of the following are true:

- explicit NGN product/market prices exist in PostgreSQL;
- Kredal test platform key and webhook secret are configured;
- one store can connect and reach `active`;
- create-payment, signed-webhook, verify, cancel and refund flows pass end to end;
- duplicate webhook and idempotency tests pass;
- live credentials are issued through Kredal's licensed-partner go-live process.
