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


## Test-mode implementation

The current Zayvi test lifecycle uses these server-only environment variables:

- `KREDAL_MODE=test`
- `KREDAL_API_URL` (optional; defaults to `https://api.kredal.africa`)
- `KREDAL_PLATFORM_KEY`
- `KREDAL_WEBHOOK_SECRET`

Do not prefix any secret with `NEXT_PUBLIC_`.

### Test connection

Admin can create the main store's test connection from the Payments page. Zayvi:

1. reads the main store id from the AWS commerce API;
2. calls Kredal `POST /v1/platform/connections`;
3. stores the returned `kc_...` connection id;
4. opens the returned approval URL;
5. refreshes the connection against Kredal until it becomes `active`.

### Test payment lifecycle

A test payment can be created only for an existing Zayvi order where:

- market is `NG`;
- currency is `NGN`;
- payment state is unpaid/pending;
- the store's Kredal connection is active.

The amount is loaded from PostgreSQL and converted to kobo on the server. The browser cannot choose or override the charge amount.

Zayvi then:

1. calls `POST /v1/kpay/payments` with the Zayvi order number as reference;
2. persists a `commerce_payment_attempts` row;
3. sends the administrator/buyer to Kredal's hosted test checkout;
4. verifies state through `GET /v1/kpay/payments/{id-or-reference}`;
5. applies only supported verified statuses to Zayvi's payment/order state.

Cancel and refund actions are also server-only and followed by a fresh Kredal lookup before Zayvi changes local state.

### Signed webhook ledger

`POST /api/payments/kredal/webhook`:

- reads the raw request body;
- verifies `X-Kredal-Signature` with HMAC-SHA256;
- rejects signatures older than five minutes;
- accepts only the documented Kredal event types;
- stores the full JSON envelope once using the external event id.

The original integration note does not define the exact nested data shape for every webhook event. Zayvi therefore stores signed events but does not guess payment references or mutate money state from undocumented fields. Payment state is reconciled through Kredal's payment lookup.

### Preview fulfilment safety

A simulated paid result may set a Preview order's payment state to paid for lifecycle testing, but Preview orders are hard-blocked from entering real processing or fulfilment.

This is independent of the UI. The restriction is enforced by the AWS commerce API.
