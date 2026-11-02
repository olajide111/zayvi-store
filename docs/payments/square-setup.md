# Square card payments

ZAYVI offers PayPal and Square card checkout. Square card fields are rendered by Square's Web Payments SDK; raw card numbers and CVV are not sent to ZAYVI.

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

Use Square sandbox credentials and a sandbox application ID/location ID together for preview deployments. Use production credentials only for the production deployment after end-to-end testing and account verification.

## Release checklist

1. Confirm the Square account is approved for card processing and the correct UK location is active.
2. Add matching sandbox credentials to Vercel Preview environment variables.
3. Test successful card payment, declined card, invalid card details, network interruption, and repeated submission.
4. Confirm the Square dashboard records the expected GBP amount and location.
5. Confirm the success page is reached only after the server reports a successful Square payment.
6. Add production credentials to the Production environment only after preview tests pass.
7. Verify refund handling, order persistence, payment webhooks, reconciliation and customer support procedures before launch.

## Important implementation boundary

The current integration creates a Square payment and returns its provider payment ID. It does not yet provide the complete durable order lifecycle. Before live launch, persist a pending order before payment, associate the Square payment with that order, process signed Square webhooks idempotently, and reconcile refunds and fulfilment status. Do not treat a browser redirect alone as proof of payment.
