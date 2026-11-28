mock_provider "aws" {
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::001961766018:role/zayvi-test" }
  }
  mock_resource "aws_lambda_function" {
    defaults = {
      arn        = "arn:aws:lambda:eu-west-2:001961766018:function:zayvi-test"
      invoke_arn = "arn:aws:apigateway:eu-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-2:001961766018:function:zayvi-test/invocations"
    }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:eu-west-2:001961766018:log-group:/aws/lambda/zayvi-test" }
  }
  mock_resource "aws_apigatewayv2_api" {
    defaults = { execution_arn = "arn:aws:execute-api:eu-west-2:001961766018:abc123" }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "001961766018" }
  }
  mock_data "aws_availability_zones" {
    defaults = { names = ["eu-west-2a", "eu-west-2b"] }
  }
}
mock_provider "archive" {}

run "preview_without_webhook" {
  command = plan
  variables {
    enable_db_bootstrap               = false
    kredal_preview_webhook_secret_arn = null
  }
  assert {
    condition     = length(aws_cloudwatch_metric_alarm.lambda_throttles) == 1 && length(aws_cloudwatch_metric_alarm.application_failures) == 1
    error_message = "Only the commerce function should be monitored when the webhook is disabled."
  }
  assert {
    condition     = length(aws_apigatewayv2_route.kredal_webhook) == 0 && aws_apigatewayv2_route.default.authorization_type == "AWS_IAM"
    error_message = "The commerce default route must stay IAM-protected without a public webhook route."
  }
  assert {
    condition     = !aws_db_instance.postgres.publicly_accessible && aws_db_instance.postgres.storage_encrypted && aws_db_instance.postgres.deletion_protection && aws_db_instance.postgres.backup_retention_period >= 7
    error_message = "Keep the database private, encrypted, protected and backed up."
  }
  assert {
    condition     = length(aws_cloudwatch_metric_alarm.api_errors.alarm_actions) == 0 && !output.operational_monitoring.notifications_configured
    error_message = "Do not claim notifications are configured without an existing SNS topic."
  }
}

run "preview_with_signed_webhook" {
  command = plan
  variables {
    enable_db_bootstrap               = false
    kredal_preview_webhook_secret_arn = "arn:aws:secretsmanager:eu-west-2:001961766018:secret:zayvi/preview/test-abc123"
    operational_alarm_topic_arn       = "arn:aws:sns:eu-west-2:001961766018:preview-operations"
  }
  assert {
    condition     = length(aws_cloudwatch_metric_alarm.lambda_throttles) == 2 && length(aws_cloudwatch_metric_alarm.application_failures) == 2 && length(aws_cloudwatch_metric_alarm.webhook_runtime_errors) == 1
    error_message = "Monitor throttles, handled failures and runtime errors for the enabled webhook."
  }
  assert {
    condition     = aws_apigatewayv2_route.kredal_webhook[0].route_key == "POST /api/payments/kredal/webhook" && aws_apigatewayv2_route.default.authorization_type == "AWS_IAM"
    error_message = "Only the signature-verifying webhook route can be public."
  }
  assert {
    condition     = aws_cloudwatch_metric_alarm.gateway_server_errors.metric_name == "5xx" && aws_cloudwatch_metric_alarm.gateway_server_errors.namespace == "AWS/ApiGateway"
    error_message = "HTTP API alarms must use its 5xx metric, not REST API 5XXError."
  }
  assert {
    condition     = output.operational_monitoring.notifications_configured && contains(aws_cloudwatch_metric_alarm.api_errors.alarm_actions, var.operational_alarm_topic_arn)
    error_message = "Wire configured notification actions into the existing API alarm."
  }
  assert {
    condition     = length(aws_cloudwatch_metric_alarm.database_pressure) == 3
    error_message = "Monitor storage, memory and CPU pressure without changing the database."
  }
}


run "owner_identity_disabled_by_default" {
  command = plan
  assert {
    condition     = length(aws_cognito_user_pool.preview_owners) == 0 && output.preview_owner_identity == null
    error_message = "Ordinary Preview plans must not create owner identity resources."
  }
  assert {
    condition     = length(aws_lambda_function.merchant_registration) == 0 && length(aws_vpc_endpoint.merchant_proof) == 0 && output.preview_merchant_registration == null
    error_message = "Merchant registration infrastructure must be opt-in."
  }
}

run "owner_identity_reviewed_preview_only" {
  command = plan
  variables {
    preview_owner_identity = {
      origin        = "https://preview.zayvi.store"
      domain_prefix = "zayvi-preview-owners-001961766018"
    }
  }
  assert {
    condition     = aws_cognito_user_pool.preview_owners[0].user_pool_tier == "LITE" && aws_cognito_user_pool.preview_owners[0].mfa_configuration == "ON" && aws_cognito_user_pool.preview_owners[0].software_token_mfa_configuration[0].enabled && aws_cognito_user_pool.preview_owners[0].admin_create_user_config[0].allow_admin_create_user_only && aws_cognito_user_pool.preview_owners[0].deletion_protection == "ACTIVE"
    error_message = "Preview owners require controlled provisioning, TOTP MFA, Lite tier and deletion protection."
  }
  assert {
    condition     = !aws_cognito_user_pool_client.preview_owners[0].generate_secret && aws_cognito_user_pool_client.preview_owners[0].enable_token_revocation && toset(aws_cognito_user_pool_client.preview_owners[0].allowed_oauth_flows) == toset(["code"]) && toset(aws_cognito_user_pool_client.preview_owners[0].callback_urls) == toset(["https://preview.zayvi.store/api/owner/auth/callback"]) && aws_cognito_user_pool_client.preview_owners[0].access_token_validity == 60 && aws_cognito_user_pool_client.preview_owners[0].id_token_validity == 60
    error_message = "Use a no-secret, revocable, code-flow Preview client with the exact callback and one-hour tokens."
  }
  assert {
    condition     = aws_cognito_resource_server.preview_owners[0].identifier == "zayvi" && aws_cognito_user_pool_domain.preview_owners[0].managed_login_version == 1 && !output.preview_owner_identity.runtime_ready
    error_message = "Keep the existing resource scope and Lite-compatible classic login; infrastructure alone cannot enable runtime access."
  }
}

run "owner_identity_rejects_production_origin" {
  command = plan
  variables {
    preview_owner_identity = {
      origin        = "https://www.zayvi.store"
      domain_prefix = "zayvi-preview-owners-001961766018"
    }
  }
  expect_failures = [var.preview_owner_identity]
}

run "merchant_registration_private_preview_only" {
  command = plan
  variables {
    preview_owner_identity = {
      origin        = "https://preview.zayvi.store"
      domain_prefix = "zayvi-preview-owners-001961766018"
    }
    preview_merchant_registration = {
      proof_secret_arn = "arn:aws:secretsmanager:eu-west-2:001961766018:secret:zayvi/preview/merchant-registration-proof-abc123"
      vercel_team_slug = "merchant-team"
    }
  }
  assert {
    condition     = aws_lambda_function.merchant_registration["preview"].function_name == "zayvi-preview-merchant-registration" && aws_lambda_function.merchant_registration["preview"].publish && aws_lambda_alias.merchant_registration["preview"].name == "live"
    error_message = "Publish and target the dedicated Preview Lambda alias."
  }
  assert {
    condition     = !aws_vpc_endpoint.merchant_proof["preview"].private_dns_enabled && aws_vpc_security_group_egress_rule.merchant_to_proof_endpoint["preview"].from_port == 443 && aws_vpc_security_group_egress_rule.merchant_to_database["preview"].from_port == 5432
    error_message = "Use scoped database and endpoint access without changing the VPC's shared Secrets Manager DNS."
  }
  assert {
    condition     = aws_lambda_function.merchant_registration["preview"].environment[0].variables.ZAYVI_MERCHANT_PROOF_SECRET_ARN == var.preview_merchant_registration.proof_secret_arn && !contains(keys(aws_lambda_function.merchant_registration["preview"].environment[0].variables), "ZAYVI_MERCHANT_REGISTRATION_PROOF_KEY")
    error_message = "Terraform and Lambda configuration carry the ARN, never the proof key value."
  }
  assert {
    condition     = jsondecode(aws_iam_role.merchant_vercel["preview"].assume_role_policy).Statement[0].Condition.StringEquals["oidc.vercel.com/merchant-team:sub"] == "owner:merchant-team:project:zayvi-store:environment:preview" && aws_cognito_user_pool.preview_owners[0].admin_create_user_config[0].allow_admin_create_user_only
    error_message = "Limit web invocation to the Preview project. Public signup remains disabled."
  }
}

run "merchant_registration_rejects_unrelated_secret" {
  command = plan
  variables {
    preview_merchant_registration = {
      proof_secret_arn = "arn:aws:secretsmanager:eu-west-2:001961766018:secret:zayvi/preview/other-secret-abc123"
      vercel_team_slug = "merchant-team"
    }
  }
  expect_failures = [var.preview_merchant_registration]
}
