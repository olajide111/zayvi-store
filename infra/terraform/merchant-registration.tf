variable "preview_merchant_registration" {
  description = "Opt-in private Preview merchant registration. Use an existing proof secret and an existing Vercel OIDC provider."
  type = object({
    proof_secret_arn = string
    vercel_team_slug = string
    oidc_issuer_mode = optional(string, "team")
  })
  default = null

  validation {
    condition = var.preview_merchant_registration == null ? true : (
      can(regex("^arn:aws:secretsmanager:eu-west-2:001961766018:secret:zayvi/preview/merchant-registration-proof-[A-Za-z0-9]{6}$", var.preview_merchant_registration.proof_secret_arn)) &&
      can(regex("^[a-z0-9][a-z0-9-]{0,62}$", var.preview_merchant_registration.vercel_team_slug)) &&
      contains(["team", "global"], var.preview_merchant_registration.oidc_issuer_mode)
    )
    error_message = "Supply the dedicated London Preview merchant proof secret and a valid Vercel OIDC configuration."
  }
}

locals {
  merchant_registration = var.preview_merchant_registration == null ? {} : { preview = var.preview_merchant_registration }
  merchant_lambda_name  = "zayvi-preview-merchant-registration"
}

resource "aws_security_group" "merchant_registration" {
  for_each    = local.merchant_registration
  name        = local.merchant_lambda_name
  description = "Merchant registration Lambda; PostgreSQL and dedicated secret endpoint only."
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "merchant_proof_endpoint" {
  for_each    = local.merchant_registration
  name        = "${local.merchant_lambda_name}-proof"
  description = "Private endpoint for the merchant registration proof secret."
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_egress_rule" "merchant_to_database" {
  for_each                     = local.merchant_registration
  security_group_id            = aws_security_group.merchant_registration[each.key].id
  referenced_security_group_id = aws_security_group.database.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "database_from_merchant" {
  for_each                     = local.merchant_registration
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.merchant_registration[each.key].id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "merchant_to_proof_endpoint" {
  for_each                     = local.merchant_registration
  security_group_id            = aws_security_group.merchant_registration[each.key].id
  referenced_security_group_id = aws_security_group.merchant_proof_endpoint[each.key].id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
}

resource "aws_vpc_security_group_ingress_rule" "proof_endpoint_from_merchant" {
  for_each                     = local.merchant_registration
  security_group_id            = aws_security_group.merchant_proof_endpoint[each.key].id
  referenced_security_group_id = aws_security_group.merchant_registration[each.key].id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
}

resource "aws_iam_role" "merchant_registration" {
  for_each           = local.merchant_registration
  name               = local.merchant_lambda_name
  assume_role_policy = aws_iam_role.lambda.assume_role_policy
}

resource "aws_vpc_endpoint" "merchant_proof" {
  for_each            = local.merchant_registration
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.merchant_proof_endpoint[each.key].id]
  private_dns_enabled = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = aws_iam_role.merchant_registration[each.key].arn }
      Action    = "secretsmanager:GetSecretValue"
      Resource  = each.value.proof_secret_arn
    }]
  })
}

resource "aws_cloudwatch_log_group" "merchant_registration" {
  for_each          = local.merchant_registration
  name              = "/aws/lambda/${local.merchant_lambda_name}"
  retention_in_days = 30
}

resource "aws_iam_role_policy" "merchant_registration_vpc" {
  for_each = local.merchant_registration
  name     = "${local.merchant_lambda_name}-vpc"
  role     = aws_iam_role.merchant_registration[each.key].id
  policy   = aws_iam_role_policy.lambda_vpc.policy
}

resource "aws_iam_role_policy" "merchant_registration_access" {
  for_each = local.merchant_registration
  name     = "${local.merchant_lambda_name}-access"
  role     = aws_iam_role.merchant_registration[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "rds-db:connect"
        Resource = [
          for username in [local.database_username, "zayvi_merchant_registrar"] :
          "arn:aws:rds-db:${var.aws_region}:${data.aws_caller_identity.current.account_id}:dbuser:${aws_db_instance.postgres.resource_id}/${username}"
        ]
      },
      {
        Effect    = "Allow"
        Action    = "secretsmanager:GetSecretValue"
        Resource  = each.value.proof_secret_arn
        Condition = { StringEquals = { "aws:SourceVpce" = aws_vpc_endpoint.merchant_proof[each.key].id } }
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.merchant_registration[each.key].arn}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "merchant_registration" {
  for_each         = local.merchant_registration
  function_name    = local.merchant_lambda_name
  role             = aws_iam_role.merchant_registration[each.key].arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = "${path.module}/zayvi-preview-merchant-registration.zip"
  source_code_hash = filebase64sha256("${path.module}/zayvi-preview-merchant-registration.zip")
  timeout          = 15
  memory_size      = 256
  publish          = true

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.merchant_registration[each.key].id]
  }
  environment {
    variables = {
      DB_AUTH_MODE                    = "iam"
      DB_HOST                         = aws_db_instance.postgres.address
      DB_PORT                         = tostring(aws_db_instance.postgres.port)
      DB_NAME                         = "zayvi"
      ZAYVI_MERCHANT_PROVIDER_ISSUER  = try("https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.preview_owners[0].id}", "")
      ZAYVI_MERCHANT_PROOF_SECRET_ARN = each.value.proof_secret_arn
      ZAYVI_MERCHANT_SECRETS_ENDPOINT = "https://${aws_vpc_endpoint.merchant_proof[each.key].dns_entry[0].dns_name}"
    }
  }
  lifecycle {
    precondition {
      condition     = local.owner_identity_enabled
      error_message = "Merchant registration requires the configured Preview owner identity pool."
    }
  }
  depends_on = [
    aws_iam_role_policy.merchant_registration_vpc,
    aws_iam_role_policy.merchant_registration_access,
    aws_vpc_security_group_ingress_rule.database_from_merchant,
    aws_vpc_security_group_ingress_rule.proof_endpoint_from_merchant,
  ]
}

resource "aws_lambda_alias" "merchant_registration" {
  for_each         = local.merchant_registration
  name             = "live"
  function_name    = aws_lambda_function.merchant_registration[each.key].function_name
  function_version = aws_lambda_function.merchant_registration[each.key].version
}

resource "aws_iam_role" "merchant_vercel" {
  for_each = local.merchant_registration
  name     = "${local.merchant_lambda_name}-vercel"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "sts:AssumeRoleWithWebIdentity"
      Principal = {
        Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${each.value.oidc_issuer_mode == "team" ? "oidc.vercel.com/${each.value.vercel_team_slug}" : "oidc.vercel.com"}"
      }
      Condition = {
        StringEquals = {
          for claim, value in {
            aud = "https://vercel.com/${each.value.vercel_team_slug}"
            sub = "owner:${each.value.vercel_team_slug}:project:zayvi-store:environment:preview"
          } : "${each.value.oidc_issuer_mode == "team" ? "oidc.vercel.com/${each.value.vercel_team_slug}" : "oidc.vercel.com"}:${claim}" => value
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "merchant_invoke" {
  for_each = local.merchant_registration
  name     = "${local.merchant_lambda_name}-invoke"
  role     = aws_iam_role.merchant_vercel[each.key].name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_alias.merchant_registration[each.key].arn
    }]
  })
}

output "preview_merchant_registration" {
  description = "Private merchant registration target and web role. Does not activate public signup."
  value = var.preview_merchant_registration == null ? null : {
    function_arn = aws_lambda_alias.merchant_registration["preview"].arn
    role_arn     = aws_iam_role.merchant_vercel["preview"].arn
  }
}
