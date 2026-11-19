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

Zayvi reconciles matching test payments when a signed event arrives, even if the buyer closes checkout without returning. The Payments page shows the webhook ledger. **Verify payment** remains available for a direct lookup, and **Catch up events** recovers missed deliveries.

To check automatic reconciliation in Preview, create a fresh test checkout, simulate payment and close the hosted checkout before returning to Zayvi. Wait for Kredal to deliver the event, then open Payments directly and refresh the list and ledger without using **Verify payment** or **Catch up events**. Check for a paid order and an applied event. If the ledger is empty, check Kredal's delivery response for the configured Preview webhook URL. If the request reached the app, search Vercel runtime logs for `Kredal webhook` to see whether signature verification, validation, storage or reconciliation ran. The diagnostic logs exclude the event body, customer details and signing secret.

### Preview fulfilment safety

A simulated paid result may set a Preview order's payment state to paid for lifecycle testing, but Preview orders are hard-blocked from entering real processing or fulfilment.

This is independent of the UI. The restriction is enforced by the AWS commerce API.


## Exact webhook reconciliation contract

Kredal's confirmed platform event envelope contains:

- `id` — unique `evt_...` event id used for deduplication;
- `type`;
- `created_at`;
- `schema_version`;
- `livemode`;
- `business_id`;
- `sequence` — monotonically increasing for ordering;
- `data` — the full payment object at that moment, or the full connection object for connection events.

Zayvi persists the envelope and applies events in sequence order. For the same payment or connection, an older sequence is ignored even if delivery arrives later.

Payment events are matched to Zayvi using:

- `data.reference` = Zayvi order number;
- `data.id` = Kredal payment id;
- `data.connection_id` = stored Kredal store connection;
- `data.amount_minor` = exact stored order amount in kobo;
- `data.currency` = `NGN`.

Zayvi refuses to apply a payment event when amount, currency or connection does not match its own records.

### Authoritative state mapping

Zayvi reconciles primarily from `payment_state`, with `hold_state` for held/pay-on-delivery cases:

| Kredal payment_state | hold_state | Zayvi payment attempt | Zayvi order payment |
| --- | --- | --- | --- |
| created | any | pending | pending |
| pending | any | pending | pending |
| succeeded | held/disputed | authorised | pending |
| succeeded | null/released | captured | paid |
| failed | any | failed | failed |
| cancelled | any | cancelled | failed |
| expired | any | failed | failed |
| partially_refunded | any | partially_refunded | partially_refunded |
| refunded | any | refunded | refunded |

A failed or expired Kredal attempt does not automatically cancel the Zayvi order, because another payment attempt may still be possible. A cancelled payment can cancel the pending Zayvi order.

Refund states are monotonic: a late paid/succeeded event cannot overwrite a partial or full refund.

### Missed event recovery

Kredal retries webhook delivery, but Zayvi also supports catch-up from:

`GET /v1/kpay/events?after=<last sequence>`

The admin Payments page starts from the highest locally stored sequence and processes returned pages in order. Existing event ids remain idempotent, and stale sequences are ignored.

### Receive webhooks while Vercel Preview is protected

The Preview AWS HTTP API can receive `POST /api/payments/kredal/webhook` directly. The gateway sends only this exact route to the signature-verifying Lambda. The default commerce route still requires AWS IAM. The receiver accepts only signed test-mode events and forwards them to the existing commerce Lambda and ledger.

#### Prepare the Preview plan

In AWS Secrets Manager in account `001961766018` and region `eu-west-2`, save the Kredal **test webhook signing secret** as a plain-text secret encrypted with the default Secrets Manager key. Copy its full ARN. Supply the ARN in the existing Preview Terraform variables for this and subsequent plans. Terraform only needs the ARN.

From the Zayvi repository root on a commit containing `infra/terraform/kredal-webhook.tf`, run this with your usual Preview AWS profile and Terraform inputs. It saves a plan for review.

```bash
(
  set -e
  cd "$(git rev-parse --show-toplevel)"
  test -f infra/terraform/kredal-webhook.tf
  export AWS_REGION=eu-west-2 AWS_DEFAULT_REGION=eu-west-2 AWS_PAGER=
  account="$(aws sts get-caller-identity --query Account --output text)"
  if [ "$account" != "001961766018" ]; then
    printf 'Expected Zayvi Preview account 001961766018, got %s\n' "$account" >&2
    exit 1
  fi

  printf 'Paste the AWS Secrets Manager ARN for the Kredal test signing secret: '
  IFS= read -r secret_arn
  test -n "$secret_arn"
  resolved_arn="$(aws secretsmanager describe-secret \
    --secret-id "$secret_arn" --query ARN --output text)"
  export TF_VAR_kredal_preview_webhook_secret_arn="$resolved_arn"

  cd infra/terraform
  terraform init -reconfigure -input=false
  state_resources="$(terraform state list)"
  printf '%s\n' "$state_resources" | grep -Fxq 'aws_lambda_function.api'
  printf '%s\n' "$state_resources" | grep -Fxq 'aws_apigatewayv2_stage.default'
  if printf '%s\n' "$state_resources" | grep -Fxq 'aws_lambda_function.db_bootstrap[0]'; then
    bootstrap_enabled=true
  else
    bootstrap_enabled=false
  fi

  npm --prefix ../lambda ci
  npm --prefix ../lambda run package
  if [ "$bootstrap_enabled" = true ]; then
    npm --prefix ../db-bootstrap ci
    npm --prefix ../db-bootstrap run package
  fi

  terraform validate
  plan_dir="$(mktemp -d "${TMPDIR:-/tmp}/zayvi-kredal-plan.XXXXXX")"
  plan_file="$plan_dir/preview-kredal-webhook.tfplan"
  terraform plan -input=false -var="enable_db_bootstrap=$bootstrap_enabled" -out="$plan_file"
  printf '\nSaved plan: %s\n' "$plan_file"
  terraform show -no-color "$plan_file"
)
```

For a first activation, expect the dedicated webhook Lambda, log group, IAM role and policy, API Gateway route and integration, Lambda invoke permission, and an update to the existing stage for route throttling. If the plan also proposes commerce Lambda, RDS, VPC, S3, CloudFront, payment production configuration, or database bootstrap changes, resolve those separately before applying the webhook plan. The saved plan may contain sensitive values. Share only the action and resource names if you need someone else to review the scope.

#### Apply and verify

1. From `infra/terraform`, apply the reviewed plan with `terraform apply "/path/from-the-output/preview-kredal-webhook.tfplan"`. Then run `terraform output -raw kredal_preview_webhook_url`.
2. Save the secret ARN in the Preview deployment inputs so later plans keep the webhook enabled.
3. Register the URL in Kredal's **test** webhook settings with the matching signing secret. Keep Vercel Deployment Protection enabled.
4. Send an unsigned POST to the AWS URL. Expect HTTP `401` and no ledger entry. An HTTP `403` means you still need to check gateway routing, activation, or the URL. Inspect the Preview gateway access log and the Kredal webhook Lambda log to see whether the request reached the handler.

   ```bash
   webhook_url="$(terraform output -raw kredal_preview_webhook_url)"
   curl -sS -o /dev/null -w 'HTTP %{http_code}\n' \
     -H 'Content-Type: application/json' -d '{}' "$webhook_url"
   ```

5. Run one simulated payment and close checkout before it returns to Zayvi. Confirm the order reaches **Paid** and the corresponding event is **Applied** before using **Verify payment** or **Catch up events**.


## Preview acceptance evidence — 18 November 2026

These results were reported by the owner from the deployed Preview UI and Kredal delivery history. They cover simulated payments only.

| Scenario | Evidence | Result |
| --- | --- | --- |
| Automatic payment reconciliation | Order `ZV-20261118-542385A7`, NGN 3,500; payment `rq_lPsvGzg9Vn0`; event `evt_4NYzrWh6bzXmtg`, sequence 49, applied at 19:09:50 UTC. Owner confirmed no manual verification or catch-up action. | Passed |
| Full refund | Order `ZV-20261118-20F70D6F`; Kredal lookup reports one successful refund `rf_uDkACzpIMqwr`, `refunded_minor=350000`, payment and Zayvi payment status refunded. | Passed |
| Duplicate delivery | Refund event `evt_vXIG_7bdKEo1Pg`, sequence 45, redelivered twice with the same ID and body, fresh signatures and HTTP 200 responses. Ledger retained one applied entry with original receipt time 14:01:18 UTC. Provider lookup retained one refund. | Passed |
| Unpaid cancellation | Order `ZV-20261118-4690D4D0`, NGN 4,500; Kredal payment cancelled; Zayvi attempt and order cancelled, payment status failed. Event `evt_lRiKMVyIvP1n7Q`, sequence 47, applied at 19:05:09 UTC. | Passed |

The refund route sends a stable `Idempotency-Key` derived from the order and requested amount. The duplicate-webhook result above does not independently test retrying a refund API request.

Remaining deployed acceptance checks include failed/expired payments, recovery of a deliberately missed event and retrying the same refund request with its original idempotency key. Late paid events after refund and invalid signature rejection also need deployed evidence distinct from local regression checks. Preview test orders must remain blocked from real fulfilment.

Production activation is a separate release: confirm live credentials and connection, a separate endpoint/signing secret, explicit server-side NGN prices and live-mode handling before approving real payment execution. Preserve the Preview secret ARN in future Terraform inputs; review the full infrastructure plan after the scoped webhook activation without applying unrelated changes.
