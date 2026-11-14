variable "enable_db_bootstrap" {
  description = "Temporarily enable the private database bootstrap Lambda and migration invocation."
  type        = bool
  default     = false
}

resource "aws_security_group" "db_bootstrap" {
  count = var.enable_db_bootstrap ? 1 : 0

  name        = "${local.common_name}-db-bootstrap"
  description = "Temporary Zayvi database bootstrap Lambda."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name      = "${local.common_name}-db-bootstrap-sg"
    Temporary = "true"
  }
}

resource "aws_security_group" "secrets_endpoint" {
  count = var.enable_db_bootstrap ? 1 : 0

  name        = "${local.common_name}-secrets-endpoint"
  description = "Temporary Secrets Manager endpoint for database bootstrap."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name      = "${local.common_name}-secrets-endpoint-sg"
    Temporary = "true"
  }
}

resource "aws_vpc_security_group_egress_rule" "bootstrap_to_database" {
  count = var.enable_db_bootstrap ? 1 : 0

  security_group_id            = aws_security_group.db_bootstrap[0].id
  referenced_security_group_id = aws_security_group.database.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Temporary bootstrap access to PostgreSQL."
}

resource "aws_vpc_security_group_ingress_rule" "database_from_bootstrap" {
  count = var.enable_db_bootstrap ? 1 : 0

  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.db_bootstrap[0].id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Temporary PostgreSQL access from bootstrap Lambda."
}

resource "aws_vpc_security_group_egress_rule" "bootstrap_to_secrets_endpoint" {
  count = var.enable_db_bootstrap ? 1 : 0

  security_group_id            = aws_security_group.db_bootstrap[0].id
  referenced_security_group_id = aws_security_group.secrets_endpoint[0].id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  description                  = "Bootstrap access to private Secrets Manager endpoint."
}

resource "aws_vpc_security_group_ingress_rule" "secrets_endpoint_from_bootstrap" {
  count = var.enable_db_bootstrap ? 1 : 0

  security_group_id            = aws_security_group.secrets_endpoint[0].id
  referenced_security_group_id = aws_security_group.db_bootstrap[0].id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  description                  = "HTTPS from bootstrap Lambda only."
}

resource "aws_vpc_endpoint" "secretsmanager" {
  count = var.enable_db_bootstrap ? 1 : 0

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.secrets_endpoint[0].id]
  private_dns_enabled = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = aws_db_instance.postgres.master_user_secret[0].secret_arn
    }]
  })

  tags = {
    Name      = "${local.common_name}-secretsmanager"
    Temporary = "true"
  }
}

resource "aws_iam_role" "db_bootstrap" {
  count = var.enable_db_bootstrap ? 1 : 0

  name = "${local.common_name}-db-bootstrap"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Temporary = "true"
  }
}

resource "aws_cloudwatch_log_group" "db_bootstrap" {
  count = var.enable_db_bootstrap ? 1 : 0

  name              = "/aws/lambda/${local.common_name}-db-bootstrap"
  retention_in_days = 7

  tags = {
    Temporary = "true"
  }
}

resource "aws_iam_role_policy" "db_bootstrap_logs" {
  count = var.enable_db_bootstrap ? 1 : 0

  name = "${local.common_name}-db-bootstrap-logs"
  role = aws_iam_role.db_bootstrap[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "${aws_cloudwatch_log_group.db_bootstrap[0].arn}:*"
    }]
  })
}

resource "aws_iam_role_policy" "db_bootstrap_vpc" {
  count = var.enable_db_bootstrap ? 1 : 0

  name = "${local.common_name}-db-bootstrap-vpc"
  role = aws_iam_role.db_bootstrap[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy" "db_bootstrap_secret" {
  count = var.enable_db_bootstrap ? 1 : 0

  name = "${local.common_name}-db-bootstrap-secret"
  role = aws_iam_role.db_bootstrap[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = aws_db_instance.postgres.master_user_secret[0].secret_arn
    }]
  })
}

resource "aws_lambda_function" "db_bootstrap" {
  count = var.enable_db_bootstrap ? 1 : 0

  function_name = "${local.common_name}-db-bootstrap"
  role          = aws_iam_role.db_bootstrap[0].arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"

  filename         = "${path.module}/zayvi-db-bootstrap.zip"
  source_code_hash = filebase64sha256("${path.module}/zayvi-db-bootstrap.zip")

  timeout     = 120
  memory_size = 512

  vpc_config {
    subnet_ids = aws_subnet.private[*].id
    security_group_ids = [
      aws_security_group.db_bootstrap[0].id
    ]
  }

  environment {
    variables = {
      DB_HOST           = aws_db_instance.postgres.address
      DB_PORT           = tostring(aws_db_instance.postgres.port)
      DB_NAME           = "zayvi"
      APP_DB_USER       = local.database_username
      MASTER_SECRET_ARN = aws_db_instance.postgres.master_user_secret[0].secret_arn
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.db_bootstrap,
    aws_iam_role_policy.db_bootstrap_logs,
    aws_iam_role_policy.db_bootstrap_vpc,
    aws_iam_role_policy.db_bootstrap_secret,
    aws_vpc_endpoint.secretsmanager,
    aws_vpc_security_group_egress_rule.bootstrap_to_database,
    aws_vpc_security_group_ingress_rule.database_from_bootstrap,
    aws_vpc_security_group_egress_rule.bootstrap_to_secrets_endpoint,
    aws_vpc_security_group_ingress_rule.secrets_endpoint_from_bootstrap
  ]

  tags = {
    Name      = "${local.common_name}-db-bootstrap"
    Temporary = "true"
  }
}

resource "aws_lambda_invocation" "db_bootstrap" {
  count = var.enable_db_bootstrap ? 1 : 0

  function_name = aws_lambda_function.db_bootstrap[0].function_name

  input = jsonencode({
    action = "bootstrap"
  })

  triggers = {
    package_sha256 = filebase64sha256("${path.module}/zayvi-db-bootstrap.zip")
    database_id    = aws_db_instance.postgres.resource_id
  }

  depends_on = [
    aws_lambda_function.db_bootstrap
  ]
}

output "db_bootstrap_result" {
  description = "Non-secret result returned by the temporary database bootstrap Lambda."
  value = var.enable_db_bootstrap ? try(
    jsondecode(aws_lambda_invocation.db_bootstrap[0].result),
    null
  ) : null
}
