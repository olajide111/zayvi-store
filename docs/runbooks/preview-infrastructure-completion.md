# Preview infrastructure completion and operation

Scope: account `001961766018`, London `eu-west-2`, existing Preview backend only. This change does not create a production stack or enable live payments. No database, VPC, media bucket or CloudFront changes are intended.

## Delivery status

| Area | Evidence / remaining activation |
| --- | --- |
| Existing private database, IAM commerce API and signing receiver | Existing configuration; user demonstrated payment/refund/cancel webhooks and duplicate handling on 18 November 2026. |
| Schema | User reported migration 0028 complete; confirm System Readiness still reports 0011–0028. |
| Deterministic archives, full-plan guard and current CI coverage | Repository implementation; run checks before apply. First archive-format change produces one expected Lambda code hash update. |
| Operational alarms and log metrics | New Terraform resources; require a reviewed AWS plan/apply. Their existence in code does not mean they are active. |
| Alert delivery | Supply an existing SNS topic ARN and verify a subscription is confirmed. Null means console-only monitoring. No recipient has been selected by this change. |
| CLI log access | Scoped read policy prepared in `infra/iam/preview-observer-policy.json`. An authorised IAM administrator must review/attach it; it is not attached automatically. |
| Restore readiness | Automated backups configured, restore drill not demonstrated. Follow the isolated drill below and record evidence. |
| Production | Separate deployment and release approval remain necessary. |

## 1. Prepare and save a full plan

Use the reviewed branch commit, Node.js 22+ and Terraform 1.14.9. Authenticate AWS CLI with the existing Preview profile. Do not use a new state, workspace or `-target`.

```bash
git fetch origin zayvi-admin-dashboard
# Use your reviewed checkout or worktree of that branch.
bash infra/scripts/preview-plan.sh
```

If a signing receiver already exists, the helper reads its secret ARN from Lambda configuration; it does not fetch the secret value. If this metadata read is unavailable, export the existing ARN as `TF_VAR_kredal_preview_webhook_secret_arn` and rerun. Do not rotate the Kredal API key or signing secret for this infrastructure change.

For notifications, supply `TF_VAR_operational_alarm_topic_arn` pointing to an existing same-account London SNS topic with appropriate topic policy and confirmed subscribers. Private `.auto.tfvars` values override environment variables; make those values consistent before planning. The helper explicitly preserves the active webhook and bootstrap state in its plan arguments. Keep these inputs for later plans to avoid disabling features.

The expected changes are new CloudWatch metric filters/alarms, action wiring on the existing runtime-error alarm, and commerce/receiver code updates for payload-free error markers. A changed bootstrap ZIP may update that temporary function and replace its invocation; inspect its unchanged migration files and checksum-ledger result. The helper permits only that specific invocation replacement while still flagging database/network/media changes and unrelated IAM updates. It blocks any other deletion/replacement. Resolve blocked drift as separate reviewed work; do not ignore it or use targeting to conceal it.

A passing scope check only makes the plan ready for manual review. Inspect the full saved plan locally, review CloudWatch charges, then run the exact saved-plan apply command printed by the helper. The helper never applies. Preserve its `commit.txt` and post-apply resource/action summary, not secret values.

## 2. Verify after apply

```bash
terraform -chdir=infra/terraform output operational_monitoring
terraform -chdir=infra/terraform output -raw kredal_preview_webhook_url
aws cloudwatch describe-alarms --region eu-west-2 \
  --alarm-name-prefix zayvi-preview \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Actions:AlarmActions}' --output table
aws rds describe-db-instances --region eu-west-2 \
  --db-instance-identifier zayvi-preview-postgres \
  --query 'DBInstances[0].{Private:PubliclyAccessible,Encrypted:StorageEncrypted,Protected:DeletionProtection,Retention:BackupRetentionPeriod,LatestRestore:LatestRestorableTime,Status:DBInstanceStatus}'
```

Expect a private/encrypted/protected database, retention at least seven days, an available instance and a recent latest-restorable timestamp. The new monitoring adds 11 alarms with the webhook enabled, alongside the existing commerce runtime-error alarm (12 total). Without a webhook there are 8 total. Inspect every alarm; an SNS ARN alone is not evidence of notification delivery.

Send one unsigned webhook request: expect 401 and no ledger entry. Then run one simulated payment without returning through checkout and confirm an applied event and Paid order; do a refund and verify one provider refund. Keep real fulfilment blocked. Rerun the full helper after apply: unchanged source and inputs should not propose timestamp-only code changes. Inspect remaining drift rather than automatically applying it.

## 3. Monitoring response and notification test

Handled server responses emit only an event marker and status code. The commerce marker covers direct Lambda calls as well as gateway requests. Runtime-error alarms cover exceptions/timeouts; throttling and duration are separate. Expected unsigned/stale requests and invalid test payloads do not produce a handled-server-error alarm. Existing diagnostic logs remain unchanged.

| Alarm | Trigger / response |
| --- | --- |
| Commerce runtime errors | Five errors/5 minutes; inspect runtime logs and deployment revision. |
| Application/receiver handled server errors | At least one 5xx/5 minutes; inspect database connectivity, secret loading and reconciliation logs. |
| Webhook runtime errors | At least one exception/5 minutes; inspect receiver runtime/configuration. |
| Lambda throttles | At least one/5 minutes; check concurrency and retries. |
| Lambda duration | Maximum at least 80% of function timeout in 2/3 one-minute periods. |
| Gateway 5xx | Five/5 minutes across the stage; includes backend/integration failures. |
| RDS storage/memory/CPU | Below 5 GiB free storage, below 128 MiB freeable memory, or above 85% CPU in 2/3 five-minute periods. These initial Preview thresholds require tuning from observed behaviour. |

To verify notification wiring, use a named **Preview** alarm and `aws cloudwatch set-alarm-state` to set ALARM with reason `Planned Preview notification test`; check the chosen recipient receives the message. This is a deliberate operational action, not a real application failure. Record the alarm, time and receipt, then return to normal metric evaluation. Do not inject real customer failures, disable signature checks or rotate credentials to test alarms. SNS subscriptions and alarm actions must be verified before claiming alerting complete.

## 4. Logs and access

An IAM administrator can attach the reviewed JSON observer policy to the deployment identity or a separate read-only operations role. It allows scoped Preview log reads and read-only metrics. It does not allow secret reads, deployments or production log access. Listing log groups and CloudWatch metric APIs require broad read resource scope; log contents remain scoped to the named groups.

```bash
aws logs tail /aws/lambda/zayvi-preview-api --region eu-west-2 --since 30m --no-cli-pager
aws logs tail /aws/lambda/zayvi-preview-kredal-webhook --region eu-west-2 --since 30m --no-cli-pager
```

Share only relevant diagnostic lines with customer details removed. Never print Secrets Manager values, platform keys, raw payment envelopes or entire plans into support chats.

## 5. Isolated restore drill

Backups are configured but recovery is unverified until tested. Record the source DB's latest restorable time, subnet group and security groups using DescribeDBInstances. Have the AWS operator restore that timestamp to a **new, uniquely named Preview recovery instance** in the existing private DB subnet group, with public access disabled and deletion protection enabled. Do not restore over, rename or point the application at the current database. A temporary recovery DB is billable; agree the time window and cleanup before creating it.

Give only an isolated test client access through its own reviewed security group. Check TLS/IAM connection, schema-migration checksums through 0028, application-role privileges and the synthetic test order/event records. Measure restore time and the latest recovered record against agreed recovery objectives. Do not run the bootstrap blindly, reprocess webhooks, send supplier messages or enable fulfilment on the recovered copy. Record pass/fail and then review cleanup of only the temporary instance, including any required final snapshot. Never alter the existing RDS deletion protection or state to perform the drill.

## 6. Bootstrap cleanup and production handover

After schema and flows pass, a separate reviewed plan may remove temporary bootstrap resources. This helper deliberately preserves their state; use the existing migration runbook for cleanup review. Do not delete migration-ledger rows or edit applied migrations.

Production requires a separate Terraform root/backend and credentials; seller identity/RBAC/MFA and tenant authorisation; live-mode payment/webhook handling and independent secret; explicit market prices; verified payment/fulfilment release gates; capacity/failover decisions; restore and alert-delivery evidence; and explicit release approval. None of these is implied by a successful Preview apply.

References: [S3 backend locking](https://developer.hashicorp.com/terraform/language/backend/s3), [HTTP API metrics](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-metrics.html), [Lambda metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics-types.html), [RDS metrics](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-metrics.html).

## References

- [Terraform S3 backend and native state locking](https://developer.hashicorp.com/terraform/language/backend/s3).
- [AWS HTTP API metrics](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-metrics.html).
- [Lambda invocation metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics-types.html).
- [RDS CloudWatch metrics](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-metrics.html).
- [CloudWatch log-filter syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html).
