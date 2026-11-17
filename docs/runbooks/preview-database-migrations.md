# Preview database migration activation

This runbook applies Zayvi schema migrations to the **Preview** PostgreSQL database using the existing temporary database-bootstrap Lambda and Terraform state.

It is intentionally limited to Preview. Do not reuse these commands against Production.

## Current target

The checkout delivery change requires migration `0025_order_delivery_address.sql` and the API Lambda from the same commit. Storefront publishing also requires `0026_storefront_content.sql`. On a Preview database already at 0024, only 0025 and 0026 should apply. The package includes earlier migrations for Preview environments that are catching up:

- `0011_inventory_ledger.sql`
- `0012_supplier_registry.sql`
- `0013_fulfilment_planning.sql`
- `0014_fulfilment_execution.sql`
- `0015_supplier_verification_audit.sql`
- `0016_purchase_orders.sql`
- `0017_supplier_feed_discovery.sql`
- `0018_supplier_feed_observability.sql`
- `0019_vendor_portal_access.sql`
- `0020_supplier_api_credentials.sql`
- `0021_supplier_inventory_sync.sql`
- `0022_returns_reverse_inventory.sql`
- `0023_vendor_purchase_order_updates.sql`
- `0024_operations_audit.sql`
- `0025_order_delivery_address.sql`
- `0026_storefront_content.sql`

The bootstrap runner is checksum-protected and only applies migrations not already recorded in `zayvi_schema_migrations`.

## Preconditions

1. Work from the reviewed commit that contains the target migrations and corresponding API implementation.
2. AWS CLI must be authenticated to account `001961766018`.
3. AWS region must be `eu-west-2`.
4. Terraform must initialise against the existing remote Preview state.
5. `enable_db_bootstrap=true` must remain enabled for this migration apply.
6. Review the saved Terraform plan before applying it.
7. Do not change the S3, CloudFront, RDS deletion-protection or production-payment configuration as part of this operation.

## Local repository path

From the Zayvi repository root:

```bash
npm --prefix infra/lambda ci
npm --prefix infra/lambda run package
npm --prefix infra/db-bootstrap ci
npm --prefix infra/db-bootstrap run package

cd infra/terraform
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
migrations/0013_fulfilment_planning.sql
migrations/0014_fulfilment_execution.sql
migrations/0015_supplier_verification_audit.sql
migrations/0016_purchase_orders.sql
migrations/0017_supplier_feed_discovery.sql
migrations/0018_supplier_feed_observability.sql
migrations/0019_vendor_portal_access.sql
migrations/0020_supplier_api_credentials.sql
migrations/0021_supplier_inventory_sync.sql
migrations/0022_returns_reverse_inventory.sql
migrations/0023_vendor_purchase_order_updates.sql
migrations/0024_operations_audit.sql
migrations/0025_order_delivery_address.sql
migrations/0026_storefront_content.sql
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

The bootstrap Lambda and invocation may change when the migration package changes. For checkout delivery, package the matching API Lambda from the same commit before planning and review its code update alongside the bootstrap changes.

Stop if the plan proposes destructive RDS, VPC, S3, CloudFront or unrelated IAM changes.

## Apply the reviewed plan

```bash
terraform apply zayvi-preview-migrations.tfplan
```

The bootstrap output should report `bootstrap_complete`.

For this activation, `migrationsApplied` should include migrations 0011 through 0026 when they were not already applied.

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
8. A supplier can be moved through pending review → verified/rejected with an audit event recorded.
9. A draft fulfilment plan can be generated for an order without auto-routing or contacting suppliers.
10. Preview/test orders remain blocked from approving or executing real fulfilment.
11. Replenishment watchlist loads and keeps automatic reordering disabled.
12. Purchase Orders loads, remains manually approved/submitted, and stock receipt writes to owned inventory.
13. Product Discovery loads, keeps auto-publish disabled, and supplier feed imports remain review-first.
14. Feed history records accepted/rejected rows and prevents exact supplier-payload replay.
15. System Readiness reports migrations 0011–0026 as applied.
16. Vendor Portal access can issue a one-time invitation, activate a supplier-scoped session and keep viewer accounts read-only.
17. A verified supplier can receive a revocable `feed:write` API credential, submit a test feed through `/api/vendor-feed/v1/ingest`, and see the batch enter Product Discovery without auto-publishing.
18. A supplier can receive a separate `inventory:write` credential, submit stock snapshots through `/api/vendor-inventory/v1/sync`, and see matched/unmatched/stale results without changing owned inventory or publication.
19. Admin → Returns can create a return from paid order lines, approve/reject it, receive and inspect goods, restock only approved quantities, and reconcile refunds only after provider-controlled payment state changes.
20. A vendor user can see only their supplier's submitted POs, acknowledge or flag fulfilment issues, and report shipment/tracking without changing PO status or inventory. Admin PO detail shows the supplier event history.
21. Admin → Operations Audit records prospective supplier verification, discovery decisions, PO approval/submission/receipt, vendor PO evidence and returns lifecycle actions in an append-only ledger.

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
