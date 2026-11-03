# Zayvi AWS preview infrastructure

This directory contains the initial Terraform definition for the approved Zayvi preview infrastructure in `eu-west-2`.

## What this configuration defines

- Dedicated VPC with two private subnets across two Availability Zones.
- Separate public subnets and an Internet Gateway, but no public application workloads.
- No NAT Gateway and no default internet route from private subnets.
- Lambda security group with PostgreSQL-only egress.
- RDS security group accepting PostgreSQL only from the Lambda security group.
- Private, encrypted, Single-AZ PostgreSQL RDS with 20 GiB initial gp3 storage, managed master password, IAM database authentication and seven-day automated backups.
- API Gateway HTTP API connected to a small Lambda bootstrap.
- CloudWatch log groups with 30-day retention and an initial Lambda error alarm.
- Least-privilege IAM policies for Lambda logs, VPC attachment and the scoped RDS IAM database user.

The Lambda currently returns HTTP 503 intentionally. This is an infrastructure bootstrap, not a working commerce API. Do not connect the storefront or enable customer operations until authentication, request validation, tenant resolution, database migrations, application routes, rate limiting and security tests are implemented.

## Important implementation notes

1. The RDS master password is managed by RDS through Secrets Manager; it is not placed in Terraform variables or source control. This adds a small recurring Secrets Manager charge.
2. The application database role `zayvi_app` and its PostgreSQL grants still need to be created securely. The IAM policy only authorises IAM database authentication for that named database user; it does not create the user or grant SQL permissions.
3. The Lambda is placed in private subnets and has no general internet egress. External integrations must not be added until their network path and cost are designed.
4. The API Gateway endpoint is publicly reachable, but the bootstrap exposes no business functionality and returns 503. A JWT/OIDC authorizer and route-level access policy are mandatory before real endpoints are enabled.
5. Single-AZ is an explicit initial availability trade-off. Backups are enabled, but they do not provide Multi-AZ failover.
6. The existing S3 bucket, CloudFront distribution and Vercel upload role are deliberately not modified.

## Before planning or applying

Do not apply this configuration until all of the following are complete:

- Confirm the AWS account ID and region from an authenticated AWS session.
- Inspect existing VPCs, CIDR allocations, IAM names, RDS identifiers, quotas and service availability to avoid collisions.
- Verify the selected RDS class and PostgreSQL engine version are available in London.
- Validate the configuration with a pinned Terraform CLI and provider lock file.
- Configure a secure remote Terraform state backend with encryption, versioning, restricted access and state locking. Never commit `terraform.tfstate`, plan files, credentials or generated Lambda archives.
- Generate and inspect a saved plan. Confirm it creates only the approved resources and does not modify existing S3, CloudFront or Vercel resources.
- Re-check the complete monthly estimate in AWS Pricing Calculator, including RDS, managed master-password secret, API Gateway, Lambda, CloudWatch logs/alarms, storage, snapshots and data transfer. Terraform plan is not a cost estimate.
- Confirm the estimated recurring cost remains within the approved £50/month target before applying.

## Safe local checks

From this directory, after installing Terraform:

```bash
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
terraform plan -out=zayvi-preview.tfplan
```

The plan command requires authenticated AWS access for data lookups and must be reviewed. Do not run `terraform apply` until the plan and current cost estimate have been checked against the approved scope.

For the first apply, configure the approved remote backend before creating billable infrastructure. Do not use a shared or production state file.

## Teardown

RDS deletion protection is enabled and final snapshots are required. Teardown therefore needs a deliberate maintenance step: confirm retention/legal requirements, disable deletion protection, take and verify a final snapshot, then destroy only the resources created by this Terraform state. Never delete the existing media bucket or CloudFront distribution as part of this stack.
