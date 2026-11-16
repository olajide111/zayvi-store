# Preview database migration activation

This runbook applies Zayvi schema migrations to the **Preview** PostgreSQL database using the existing temporary database-bootstrap Lambda and Terraform state.

It is intentionally limited to Preview. Do not reuse these commands against Production.

## Current target

The next unapplied migrations are expected to be:

- `0011_inventory_ledger.sql`
- `0012_supplier_registry.sql`

The bootstrap runner is checksum-protected and only applies migrations not already recorded in `zayvi_schema_migrations`.

## Preconditions

1. Work from the current `main` branch.
2. AWS CLI must be authenticated to account `001961766018`.
3. AWS region must be `eu-west-2`.
4. Terraform must initialise against the existing remote Preview state.
5. `enable_db_bootstrap=true` must remain enabled for this migration apply.
6. Review the saved Terraform plan before applying it.
7. Do not change the S3, CloudFront, RDS deletion-protection or production-payment configuration as part of this operation.

## Local repository path

From the Zayvi repository root:

```bash
cd "infra/db-bootstrap"
npm ci
npm run package

cd ../terraform
```

The packaging command copies all `database/migrations/NNNN_*.sql` files into `zayvi-db-bootstrap.zip`.

## Verify package contents

```bash
unzip -Z1 zayvi-db-bootstrap.zip | grep '^migrations/' | sort
```

Confirm the output includes:

```text
migrations/0011_inventory_ledger.sql
migrations/0012_supplier_registry.sql
```

## Initialise the existing Preview backend

```bash
terraform init -reconfigure
```

Do not migrate or replace the remote state.

## Review current state

```bash
terraform state list
```

The existing Preview stack should be present before continuing.

## Create a saved migration plan

```bash
terraform plan \
  -var="enable_db_bootstrap=true" \
  -out=zayvi-preview-migrations.tfplan
```

Review the plan:

```bash
terraform show -no-color zayvi-preview-migrations.tfplan
```

Expected migration-related change: the bootstrap Lambda package/invocation may change because the packaged migration set changed.

Stop if the plan proposes destructive RDS, VPC, S3, CloudFront or unrelated IAM changes.

## Apply the reviewed plan

```bash
terraform apply zayvi-preview-migrations.tfplan
```

The bootstrap output should report `bootstrap_complete`.

For this activation, `migrationsApplied` should include 0011 and 0012 when they were not already applied.

## Post-apply checks

Inspect the Terraform output:

```bash
terraform output db_bootstrap_result
```

Expected properties:

- `status = bootstrap_complete`
- `applicationRole = zayvi_app`
- `privilegedApplicationRole = false`
- `migrationsApplied` contains the newly applied migrations

Then validate the Preview application:

1. Admin → Inventory loads without `inventory_unavailable`.
2. UK and Nigeria inventory locations resolve.
3. A manual stock adjustment can create an inventory level.
4. Admin → Suppliers loads without `suppliers_unavailable`.
5. A supplier can be created in `pending review`.
6. Supplier detail can save a product offer.
7. Admin → Sourcing Intelligence loads and keeps automatic routing disabled.

## Rollback policy

These migrations are additive. Do not attempt an ad-hoc destructive rollback.

If application behaviour is incorrect:

1. Stop using the new inventory/supplier actions.
2. Keep automatic fulfilment routing disabled.
3. Revert application code if necessary.
4. Diagnose and apply a forward corrective migration.

Never delete migration-ledger rows or edit an already-applied migration file. The bootstrap checksum guard will reject altered historical migrations.

## Temporary bootstrap cleanup

Do **not** disable the temporary bootstrap resources until the new Preview schema and application flows are verified.

After verification, a separate reviewed Terraform change can set:

```hcl
enable_db_bootstrap = false
```

and remove only the temporary bootstrap Lambda, its temporary security groups and Secrets Manager VPC endpoint.
