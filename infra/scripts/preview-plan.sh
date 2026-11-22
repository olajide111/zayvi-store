#!/usr/bin/env bash
# Create a full saved Preview plan. This script never applies infrastructure.
set -euo pipefail
umask 077
review_scope=general
if [ "$#" -eq 1 ] && [ "$1" = --owner-identity ]; then
  review_scope=owner-identity
elif [ "$#" -ne 0 ]; then
  echo 'Usage: bash infra/scripts/preview-plan.sh [--owner-identity]' >&2
  exit 1
fi
for required_command in aws terraform node npm git; do
  command -v "$required_command" >/dev/null || { echo "Install $required_command before continuing." >&2; exit 1; }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || { echo 'Node.js 22 or newer is required.' >&2; exit 1; }
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  echo 'Commit or preserve local changes first. Plan from the reviewed commit.' >&2
  exit 1
fi
export AWS_REGION=eu-west-2 AWS_DEFAULT_REGION=eu-west-2 AWS_PAGER=
printf '[1/8] Checking AWS Preview account…\n'
account_id="$(aws sts get-caller-identity --query Account --output text)"
[ "$account_id" = 001961766018 ] || { echo 'Expected Preview AWS account 001961766018.' >&2; exit 1; }
export TMPDIR=/tmp
cd infra/terraform
for override_file in override.tf override.tf.json *_override.tf *_override.tf.json; do
  if [ -f "$override_file" ]; then
    echo "Remove or separately review the local override before a full deployment plan: $override_file" >&2
    exit 1
  fi
done
printf '[2/8] Initialising existing Preview state…\n'
terraform init -reconfigure -input=false -lockfile=readonly
[ "$(terraform workspace show)" = default ] || { echo 'Use the existing default Preview workspace; do not create or migrate state.' >&2; exit 1; }
printf '[3/8] Reading existing resources…\n'
state_resources="$(terraform state list)"
for expected_resource in aws_lambda_function.api aws_db_instance.postgres aws_apigatewayv2_stage.default; do
  if ! printf '%s\n' "$state_resources" | grep -Fxq "$expected_resource"; then
    echo "Existing Preview resource missing: $expected_resource. Stop and check the backend." >&2
    exit 1
  fi
done
if printf '%s\n' "$state_resources" | grep -Fxq 'aws_lambda_function.db_bootstrap[0]'; then
  export TF_VAR_enable_db_bootstrap=true
else
  export TF_VAR_enable_db_bootstrap=false
fi
printf '[4/8] Checking webhook secret metadata…\n'
# Preserve the active webhook even when the caller forgot to export its ARN.
if [ -z "${TF_VAR_kredal_preview_webhook_secret_arn:-}" ]; then
  TF_VAR_kredal_preview_webhook_secret_arn="$(aws lambda get-function-configuration \
    --function-name zayvi-preview-kredal-webhook \
    --query Environment.Variables.KREDAL_WEBHOOK_SECRET_ARN --output text)"
  export TF_VAR_kredal_preview_webhook_secret_arn
fi
case "$TF_VAR_kredal_preview_webhook_secret_arn" in
  arn:aws:secretsmanager:eu-west-2:001961766018:secret:*) ;;
  *) echo 'A Preview Kredal signing-secret ARN is required. Set TF_VAR_kredal_preview_webhook_secret_arn.' >&2; exit 1 ;;
esac
# Read metadata only; never retrieve or print the secret value.
aws secretsmanager describe-secret --secret-id "$TF_VAR_kredal_preview_webhook_secret_arn" --query ARN --output text >/dev/null
# Recover the already-connected alert topic; do not silently remove notifications.
if [ -z "${TF_VAR_operational_alarm_topic_arn:-}" ]; then
  existing_alarm_topic="$(aws cloudwatch describe-alarms \
    --alarm-names zayvi-preview-commerce-server-errors \
    --query 'MetricAlarms[0].AlarmActions[0]' --output text)"
  case "$existing_alarm_topic" in
    arn:aws:sns:eu-west-2:001961766018:*)
      export TF_VAR_operational_alarm_topic_arn="$existing_alarm_topic"
      printf 'Preserving the existing Preview alarm notification topic.\n'
      ;;
    None|null|'') ;;
    *) echo 'Unexpected alarm topic. Review Preview inputs before planning.' >&2; exit 1 ;;
  esac
fi
printf '[5/8] Installing and packaging commerce API (npm may take time)…\n'
npm --prefix ../lambda ci
npm --prefix ../lambda run package
# Build both real archives: validation evaluates file hashes even for disabled bootstrap.
printf '[6/8] Installing and packaging database runner…\n'
npm --prefix ../db-bootstrap ci
npm --prefix ../db-bootstrap run package
printf '[7/8] Validating Terraform configuration…\n'
terraform fmt -check -recursive
terraform validate -no-color
plan_directory="$(mktemp -d /tmp/zayvi-preview-plan.XXXXXX)"
plan_path="$plan_directory/preview.tfplan"
git rev-parse HEAD > "$plan_directory/commit.txt"
printf '[8/8] Creating review plan; Terraform may wait for a state lock or provider startup…\n'
if terraform plan -input=false -detailed-exitcode \
  -var="enable_db_bootstrap=$TF_VAR_enable_db_bootstrap" \
  -var="kredal_preview_webhook_secret_arn=$TF_VAR_kredal_preview_webhook_secret_arn" \
  -out="$plan_path"; then
  plan_status=0
else
  plan_status=$?
fi
if [ "$plan_status" -ne 0 ] && [ "$plan_status" -ne 2 ]; then exit "$plan_status"; fi
printf '\nSaved plan: %s\n' "$plan_path"
# macOS ships Bash 3.2, where expanding an empty array under nounset fails.
if [ "$review_scope" = owner-identity ]; then
  terraform show -json "$plan_path" | node ../scripts/review-preview-plan.cjs --owner-identity
else
  terraform show -json "$plan_path" | node ../scripts/review-preview-plan.cjs
fi
printf '\nReview locally: terraform -chdir="%s" show -no-color "%s"\n' "$repo_root/infra/terraform" "$plan_path"
printf 'After reviewing and resolving scope issues: terraform -chdir="%s" apply "%s"\n' "$repo_root/infra/terraform" "$plan_path"
printf 'Preserve the webhook secret ARN and optional alarm topic ARN in your private Preview inputs for future plans.\n'
