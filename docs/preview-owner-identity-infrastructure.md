# Preview owner identity infrastructure

Status: the operator reported a successful Preview apply on 22 November 2026: four resources added, zero changed and zero destroyed. Pool `eu-west-2_VA9Jt43V4` and client `2rum6s096vv9b3nab5guuodfvs` passed all 15 configuration-preflight checks. Owner runtime, database migrations and sign-in routes remain disabled/pending. These deployment results were supplied by the operator; this checkout has no live AWS credentials.

## Stable Preview domain

The user selected `https://preview.zayvi.store`. Vercel associates that hostname with project `zayvi-store`, branch `zayvi-admin-dashboard`, without changing the production domains. Initial DNS propagation completed and the operator confirmed the hostname works. Its authoritative nameservers are external (`dns1.registrar-servers.com` and `dns2.registrar-servers.com`).

At the authoritative DNS provider, add the record returned by Vercel on 22 November 2026:

| Type | Host | Target |
| --- | --- | --- |
| CNAME | preview | 46d3ca43ef044d74.vercel-dns-017.com |

This is the domain-specific recommendation observed for this project, not a universal Vercel value. Recheck Vercel's domain configuration if acting later. Preserve the apex, www, email/MX and all unrelated records. DNS acceptance is not proof of propagation or HTTPS readiness; verify both after the change. Keep Vercel Preview protection enabled.

## Provisioned Preview AWS resources

`infra/terraform/owner-identity.tf` is disabled by default (`preview_owner_identity = null`). Explicit enablement proposes exactly four resources in the existing Preview state:

- `aws_cognito_user_pool.preview_owners[0]`: dedicated London pool, Lite tier, required authenticator MFA, admin-created accounts, case-insensitive email sign-in, strong passwords and deletion protection.
- `aws_cognito_resource_server.preview_owners[0]`: `zayvi/store.access`. The scope requests access; it does not grant a database membership or role.
- `aws_cognito_user_pool_client.preview_owners[0]`: code flow with no client secret, token revocation, one-hour access/ID tokens, Cognito users only and the exact Preview callback. PKCE is enforced by the application flow. Refresh tokens are not persisted by the prepared application.
- `aws_cognito_user_pool_domain.preview_owners[0]`: a unique reviewed prefix and classic hosted UI, compatible with Lite.

All four have Terraform `prevent_destroy`. Removing the input after creation should fail rather than silently remove authentication resources. No owner user, membership, IAM permissions, networking, runtime environment or public API route is created by this file. `runtime_ready` is always false in the output.

Lite supports authenticator MFA and is usage-priced. AWS currently publishes a 10,000 direct/social monthly-active-user free tier shared per account or AWS organisation, subject to its pricing terms. That is not a guaranteed zero bill; other usage/services may be charged. No SMS MFA, NAT, threat-protection add-on or M2M client-credentials flow is included. Review pricing and configuration before applying.

References: [AWS Cognito pricing](https://aws.amazon.com/cognito/pricing/), [pinned AWS provider pool schema](https://github.com/hashicorp/terraform-provider-aws/blob/v5.100.0/website/docs/r/cognito_user_pool.html.markdown), [client schema](https://github.com/hashicorp/terraform-provider-aws/blob/v5.100.0/website/docs/r/cognito_user_pool_client.html.markdown), [domain schema](https://github.com/hashicorp/terraform-provider-aws/blob/v5.100.0/website/docs/r/cognito_user_pool_domain.html.markdown).

## Prepare a concrete plan after DNS and configuration review

On this reviewed commit, put the following in private Preview Terraform inputs only when ready to plan this activation:

```hcl
preview_owner_identity = {
  origin        = "https://preview.zayvi.store"
  domain_prefix = "zayvi-preview-owners-001961766018"
}
```

The suggested prefix is not reserved or availability-verified. If AWS reports a conflict, select a new reviewed prefix; do not alter another pool/domain. Keep the existing webhook-secret and alarm-topic inputs and database bootstrap setting intact.

```bash
bash infra/scripts/preview-plan.sh --owner-identity
```

This creates a full saved plan against the existing Preview state, never applies. The separate scope check accepts only creation of exactly the four resources above. It blocks API/bootstrap updates, IAM/network changes, deletions, incomplete plans and unrelated resources. Resolve package drift or other work separately; do not use targets or ignore overrides to hide it. Ordinary plan mode flags Cognito changes for this separate review.

Review the complete saved plan and the current cost/configuration before apply. The operator's new listing permission does not grant resource creation; any required deployment permissions need a separate scoped IAM review. This repository has no authenticated AWS session available to create the live plan here.

After a successful reviewed apply, inspect `terraform output preview_owner_identity` and use the read-only preflight with those actual IDs. Do not claim login works from successful infrastructure creation alone.

## Remaining runtime gates

Hosted OAuth endpoints remain inaccessible through Cognito PrivateLink, and the private commerce Lambda has no NAT route in the approved baseline. Review the typed private-database boundary and public provider/JWKS path. Complete current-session revocation/MFA assurance, a durable limiter, reviewed SQL migrations, explicit identity membership provisioning, mounted routes and workspace/API guards. Run browser/provider-outage and actual RDS role/locking tests before enabling owner access. See [runtime](platform-owner-runtime.md) and [configuration preflight](preview-owner-activation.md).

## Validation

Terraform formatting and the plan-review/deployment-tool tests run locally. Local provider-schema validation cannot run in this environment because provider processes cannot establish their plugin socket. The GitHub workflow performs provider validation and mocked Terraform plans on an Ubuntu runner with synthetic archives, no AWS credentials and no remote backend. It never applies infrastructure. Review those results before merging or planning a live activation.
