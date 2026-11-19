# Zayvi AWS Preview infrastructure

This Terraform root owns the existing Preview state in AWS account `001961766018`, region `eu-west-2`, S3 key `zayvi/preview/terraform.tfstate`. It is not a production Terraform root. Use Terraform 1.14.9 (pinned at repository root); the configuration requires at least 1.10 for S3 native locking. Provider versions and checksums remain pinned in `.terraform.lock.hcl`.

## Current architecture

- Dedicated VPC, two private application subnets, isolated database networking and no NAT Gateway.
- Encrypted private PostgreSQL, IAM database authentication, seven-day automated backups, deletion protection and required final snapshot. Single-AZ remains the Preview availability trade-off.
- Node.js 22 commerce Lambda using the restricted `zayvi_app` database role.
- IAM-protected default HTTP API route. Vercel's existing backend role can invoke the API or commerce Lambda directly.
- Optional public, exact-match Kredal **test** webhook route with raw-body signature checks, timestamp rejection and a separate signing secret in Secrets Manager. Its dedicated receiver invokes the commerce Lambda without opening the commerce default route.
- Temporary database bootstrap applies versioned, checksum-protected migrations. Keep its enabled state until schema and application checks are complete; remove it only through a separate reviewed cleanup.
- Thirty-day logs; Lambda runtime errors, handled application errors, throttling/duration, gateway server errors and database pressure alarms. An optional existing SNS topic enables notifications. Without it, alarms are visible in CloudWatch but do not contact anyone.

The previously deployed build has demonstrated simulated payments, automatic signed-event reconciliation, refund, cancellation and duplicate event handling. See `docs/payments/kredal-pay.md` for evidence and remaining acceptance checks. Documentation of a resource is not evidence that a new change has been applied.

Existing S3 media, CloudFront, production payments and RDS protection are outside the monitoring/tooling change. The account/region guards prevent accidentally using this root for another environment.

## Validate without applying

From repository root, use Node.js 22+ and Terraform from `.terraform-version`:

```bash
node --test infra/scripts/*.test.cjs
npm --prefix infra/lambda ci
npm --prefix infra/lambda run package
npm --prefix infra/db-bootstrap ci
npm --prefix infra/db-bootstrap run package
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform init -backend=false -input=false -lockfile=readonly
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform test
```

Both archive builds use stable names, file order and ZIP metadata. Repacking unchanged source does not create timestamp-only updates. The first switch from the old ZIP format changes package hashes once. The CA bundle and dependency toolchain are still build inputs: intentional changes to either can change package bytes. `terraform test` uses mocked AWS/archive providers and plan-only runs; it does not apply resources or contact AWS. Provider installation still requires network access.

CI runs on `zayvi-admin-dashboard`, `zayvi-aws-integration` and PRs to `main`. It packages real archives, validates Terraform and checks protected Preview invariants.

## Plan and deploy

Read [Preview infrastructure completion](../../docs/runbooks/preview-infrastructure-completion.md). From a clean reviewed commit:

```bash
bash infra/scripts/preview-plan.sh
```

The helper checks AWS identity, uses the existing default workspace, preserves bootstrap state and discovers the active signing-secret ARN without reading its value. It builds real archives and saves a full plan, then prints only resource actions in its scope check. Destructive changes, database/network/media changes and IAM changes are blocked for separate review. No `-target`, no state migration and no automatic apply are used.

Copy `preview.auto.tfvars.example` to a private `preview.auto.tfvars` only after replacing the example with your existing secret ARN and matching bootstrap state. An ARN is a resource identifier, not the signing-secret value. Keep optional notification inputs persistent too. Do not commit populated inputs, state, plans, logs or generated archives. Saved plans may contain sensitive infrastructure values; inspect them locally.

After review, apply only the saved plan printed by the helper. Additional alarms/custom metrics can add CloudWatch charges: review the current account estimate against the existing Preview budget before apply. No cost estimate or AWS apply is performed by the helper.

## Operational boundaries

A successful plan is not a backup restore test, an alert-delivery test, a security review or a production release. External seller authentication, tenant identity/RBAC, production payment handling, live credentials, production capacity/failover and recovery objectives need their own release evidence. Do not enable real charges or real fulfilment from this Preview stack.
