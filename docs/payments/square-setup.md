# Square card payments

ZAYVI uses Square Web Payments SDK for card entry and Square Payments API on the server. Raw card numbers and CVV are handled by Square and are never sent to ZAYVI.

## UK cardholder authentication

UK online card payments can require Strong Customer Authentication (SCA / 3-D Secure). The checkout therefore collects the buyer's name, email and billing address and passes the billing contact, GBP amount, `intent: CHARGE`, `customerInitiated: true` and `sellerKeyedIn: false` to the Square Web Payments SDK `card.tokenize(verificationDetails)` call. The server also flags the payment as buyer-initiated using Square's `customer_details` object.

Do not replace the buyer details with hard-coded sample values. Do not set `seller_keyed_in: true` for an ordinary customer-initiated online card payment.

## Vercel environment variables

Configure these in the ZAYVI Vercel project. Never commit access tokens or paste them into source files.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `SQUARE_ACCESS_TOKEN` | Server only | Square access token for the selected environment |
| `SQUARE_LOCATION_ID` | Server only | Square location that receives payments |
| `SQUARE_ENVIRONMENT` | Server only | `sandbox` for tests or `production` for live payments |
| `NEXT_PUBLIC_SQUARE_APP_ID` | Public | Square application ID for the selected environment |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | Public | Matching Square location ID used to initialise the Web Payments SDK |
| `NEXT_PUBLIC_SQUARE_ENVIRONMENT` | Public | Must match `SQUARE_ENVIRONMENT` (`sandbox` or `production`) |
| `NEXT_PUBLIC_STORE_URL` | Public | Canonical store URL, for example `https://zayvi.store` |

Use matching Square sandbox credentials and sandbox application/location IDs for Preview deployments. Use production credentials only in the Production environment after the account and integration are approved and tested. Never mix sandbox and production IDs or tokens.

## Release checklist

1. Confirm the Square account is approved for card processing and the correct UK location is active.
2. Add matching sandbox credentials to Vercel Preview environment variables.
3. Test successful card payment, declined card, invalid card details, SCA challenge, network interruption and repeated submission.
4. Confirm the Square dashboard records the expected GBP amount and location.
5. Confirm the success page is reached only after the server retrieves the payment and sees `COMPLETED`.
6. Add production credentials to the Production environment only after preview tests pass.
7. Complete persistent order creation, signed payment webhooks, refunds, reconciliation and fulfilment before live launch.

## Current implementation boundary

The basket contains both PayPal and Square checkout. Square card details are collected through the Web Payments SDK, tokenized in the browser and charged by the server using a server-calculated GBP total. The success page retrieves the payment from Square before displaying confirmation.

The application still needs a dedicated ZAYVI database connected to the runtime, pending-order creation before payment, provider-to-order association, signed webhook processing and idempotent refund/fulfilment handling. The SQL proposal in `docs/database/commerce-schema.sql` is not applied automatically. Apply it only to a dedicated ZAYVI Supabase project after checking the target project. Do not apply it to Pulse or SellAM databases.

A successful provider payment response is not yet the same as a fully recorded ZAYVI order. Do not enable live traffic until the complete order lifecycle and sandbox tests pass.
