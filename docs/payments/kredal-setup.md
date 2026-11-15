# Kredal Pay integration

ZAYVI integrates with Kredal Pay as a payment platform. ZAYVI must not integrate directly with an underlying Nigerian rail such as Paystack when Kredal is intended to own provider selection and fallback.

## Current boundary

Kredal Pay is currently test-mode only for ZAYVI. The integration can be built and exercised end to end, but no real customer order may be fulfilled from a test payment.

Kredal currently supports NGN for this integration. UK GBP checkout remains on Square and PayPal remains an alternative/fallback while Kredal expands.

## Server-only environment variables

Configure these only in server environments:

| Variable | Purpose |
| --- | --- |
| `KREDAL_API_URL` | Kredal API base URL. Defaults in code to `https://api.kredal.africa`. |
| `KREDAL_PLATFORM_KEY` | ZAYVI platform key (`kp_plat_sk_...`). Never expose in the browser. |
| `KREDAL_WEBHOOK_SECRET` | Secret used to verify `X-Kredal-Signature`. Never expose in the browser. |

Do not prefix either secret with `NEXT_PUBLIC_`.

## Store connection

Each Nigerian ZAYVI seller/store connects its own Kredal business.

1. ZAYVI calls `POST /v1/platform/connections` with its own seller/store reference.
2. Kredal returns a connection id (`kc_...`) and an approval URL.
3. ZAYVI stores the connection id server-side and sends the owner to the approval URL.
4. The connection becomes usable only after the signed `connection.approved` event.
5. ZAYVI disables Kredal payments for that store after `connection.revoked`.

The proposed database schema stores this mapping in `commerce.payment_connections`.

## Order-first checkout

Never create a Kredal payment from a browser-supplied amount.

The required order is:

1. Price the cart on the ZAYVI server.
2. Create a persistent ZAYVI order with status `awaiting_payment`.
3. Use the ZAYVI order number as Kredal's payment `reference`.
4. Create a corresponding `commerce.payments` record.
5. Call Kredal from the server with the stored integer NGN amount in kobo.
6. Redirect the buyer to Kredal's returned `checkout_url`.
7. Mark the order paid only after a valid signed webhook or a successful server-side payment lookup.

## Payment routing

The current platform-level routing rule is:

- Nigeria + NGN -> Kredal Pay
- United Kingdom + GBP -> Square
- Other supported checkout -> PayPal fallback

Kredal, not ZAYVI, decides which underlying Nigerian provider or bank rail handles a Kredal payment.

## Webhooks

The webhook receiver must verify `X-Kredal-Signature` using the raw request body and `KREDAL_WEBHOOK_SECRET`. It must reject stale signatures, store provider event ids, and process each event idempotently because Kredal may retry deliveries.

Relevant events include:

- `payment.paid`
- `payment.held`
- `payment.released`
- `payment.refunded`
- `payment.cancelled`
- `payment.failed`
- `settlement.updated`
- `transfer.received`
- `connection.approved`
- `connection.revoked`

A browser return/callback alone is never proof of payment.

## Go-live gate

Before enabling live Nigerian orders:

1. Use a dedicated ZAYVI database and apply the reviewed commerce schema.
2. Implement persistent pending-order creation.
3. Implement store-to-Kredal connection persistence.
4. Implement signed and idempotent Kredal webhooks.
5. Test connect -> pay -> verify -> refund -> cancel in Kredal test mode.
6. Confirm test orders never enter fulfilment.
7. Receive separate live credentials only after Kredal's licensed-partner go-live process is complete.
