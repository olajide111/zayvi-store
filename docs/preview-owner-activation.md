# Preview owner sign-in configuration check

The storefront improvements are merged. Owner authentication is tested locally but not enabled. This procedure identifies existing AWS configuration without selecting a pool automatically, creating resources or changing the current admin login.

## Run from the repository root

Use Node.js 22 and your usual authenticated AWS CLI profile. The script pins account `001961766018` and region `eu-west-2`; a different account stops before any Cognito request.

```bash
node infra/scripts/owner-preview-preflight.cjs
```

This lists existing pool IDs and names. An empty `pools` list means this account/region has no pool available to select. Do not create or repurpose a production pool automatically. If the CLI reports missing read permissions, resolve the specifically named read operation using your AWS administrator; this check never edits IAM.

To list clients for a reviewed Preview pool, replace the example pool ID with its actual ID:

```bash
node infra/scripts/owner-preview-preflight.cjs --pool-id eu-west-2_POOL
```

To inspect a selected client, supply its actual ID and the exact intended Preview origin, without a trailing slash. Example placeholders must be replaced:

```bash
node infra/scripts/owner-preview-preflight.cjs \
  --pool-id eu-west-2_POOL \
  --client-id CLIENT \
  --origin https://YOUR-PREVIEW-HOST
```

The required resource scope defaults to `zayvi/store.access`; use `--scope` only for the exact reviewed client scope. The dedicated client's callback must match `<origin>/api/owner/auth/callback`. Choose a stable origin before provisioning; an individual Vercel deployment hostname will not remain the same on later deployments. Do not replace a production callback with a Preview URL.

## What the report means

- `configurationMatched` means only that the observed pool/client metadata matches the currently prepared adapter. Exit code 2 indicates mismatched configuration, 1 an input/read error, and 0 successful inspection or inventory.
- `activationReady` remains false. MFA enabled at pool level is not evidence that a particular session completed MFA, and token-revocation settings are not a live revocation check.
- `databaseLambdaInVpc` reports subnet attachment only. It does not prove provider connectivity, database grants, migrations or transaction behaviour. Null means that optional Lambda metadata could not be read.
- Only selected non-secret metadata and named checks are printed. The app-client secret value is excluded by CLI projection. AWS error bodies, Lambda environment variables, user records and Secrets Manager values are not printed.

The current pilot contract requires a dedicated Preview-tagged London pool, controlled owner provisioning, mandatory software-token MFA, a public PKCE/code-flow client, revocation, short-lived tokens, and exact issuer/domain/callback/scope settings. These are Zayvi pilot requirements, not a claim that every valid Cognito integration must use the same configuration. A newer issuer style, custom domain, client secret or federated login requires an adapter/assurance review rather than blindly changing an existing pool.

## Remaining activation work

1. Review provider configuration, cost and runtime placement. Hosted OAuth domain endpoints do not work through Cognito PrivateLink; adding that endpoint alone does not solve the private Lambda's outbound path.
2. Implement the typed private-database boundary, durable limiter and current provider/MFA assurance.
3. Promote the reviewed SQL proposals to new migrations, provision the exact owner membership and apply through the Preview saved-plan procedure.
4. Mount sign-in handlers/pages and migrate protected owner workspace/API guards. Verify browser cookies, logout, revocation, provider outages and actual RDS role/locking behaviour before enabling the pilot.
5. Connect Hammy's real catalogue and disabled-by-default checkout. Then build abandoned-cart recovery, offers/bundles and customer-care automation in that order.

This inspection does not enable payments or fulfilment, apply Terraform, retrieve webhook secrets or alter alarm inputs. Preserve the existing webhook-secret ARN and notification-topic ARN on later Preview plans.

References: [Cognito PrivateLink limitations](https://docs.aws.amazon.com/cognito/latest/developerguide/vpc-interface-endpoints.html), [DescribeUserPoolClient fields and token units](https://docs.aws.amazon.com/cli/latest/reference/cognito-idp/describe-user-pool-client.html), and [prepared runtime](platform-owner-runtime.md).
