terraform {
  backend "s3" {
    bucket       = "zayvi-terraform-state-001961766018-eu-west-2"
    key          = "zayvi/preview/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ZayviStore"
      Environment = "Preview"
      ManagedBy   = "Terraform"
      CostCentre  = "Zayvi"
    }
  }
}

variable "aws_region" {
  description = "AWS region for the initial Zayvi environment."
  type        = string
  default     = "eu-west-2"
}

variable "name_prefix" {
  description = "Prefix used for names of newly created resources."
  type        = string
  default     = "zayvi-preview"
}

variable "db_instance_class" {
  description = "Initial Single-AZ PostgreSQL instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  description = "Initial encrypted RDS storage in GiB."
  type        = number
  default     = 20

  validation {
    condition     = var.db_allocated_storage_gb >= 20
    error_message = "RDS allocated storage must be at least 20 GiB."
  }
}

variable "db_backup_retention_days" {
  description = "Automated RDS backup retention."
  type        = number
  default     = 7

  validation {
    condition     = var.db_backup_retention_days >= 7 && var.db_backup_retention_days <= 35
    error_message = "Backup retention must be between 7 and 35 days."
  }
}

variable "lambda_timeout_seconds" {
  description = "Maximum execution time for the initial API Lambda."
  type        = number
  default     = 15
}

variable "lambda_memory_mb" {
  description = "Memory allocated to the initial API Lambda."
  type        = number
  default     = 256
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)
  common_name        = var.name_prefix
  database_username  = "zayvi_app"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.40.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.common_name}-vpc"
  }
}



resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = local.availability_zones[count.index]

  tags = {
    Name = "${local.common_name}-private-${count.index + 1}"
    Tier = "private"
  }
}



resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.main.id

  # Deliberately no default route and no NAT Gateway in the approved baseline.
  tags = {
    Name = "${local.common_name}-private-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "private" {
  count = 2

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_security_group" "lambda" {
  name        = "${local.common_name}-lambda"
  description = "Zayvi API Lambda security group; database-only egress."
  vpc_id      = aws_vpc.main.id




  tags = {
    Name = "${local.common_name}-lambda-sg"
  }
}

resource "aws_security_group" "database" {
  name        = "${local.common_name}-database"
  description = "Private PostgreSQL; ingress only from the Zayvi API Lambda."
  vpc_id      = aws_vpc.main.id




  tags = {
    Name = "${local.common_name}-database-sg"
  }
}

resource "aws_vpc_security_group_egress_rule" "lambda_to_database" {
  security_group_id            = aws_security_group.lambda.id
  referenced_security_group_id = aws_security_group.database.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Lambda to PostgreSQL only."
}

resource "aws_vpc_security_group_ingress_rule" "database_from_lambda" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.lambda.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL accepts traffic from the Zayvi Lambda only."
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.common_name}-db-subnets"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.common_name}-db-subnets"
  }
}

resource "aws_db_instance" "postgres" {
  identifier                          = "${local.common_name}-postgres"
  engine                              = "postgres"
  engine_version                      = "17.11"
  instance_class                      = var.db_instance_class
  allocated_storage                   = var.db_allocated_storage_gb
  max_allocated_storage               = 100
  storage_type                        = "gp3"
  storage_encrypted                   = true
  db_name                             = "zayvi"
  username                            = "zayvi_admin"
  manage_master_user_password         = true
  iam_database_authentication_enabled = true
  port                                = 5432
  db_subnet_group_name                = aws_db_subnet_group.main.name
  vpc_security_group_ids              = [aws_security_group.database.id]
  publicly_accessible                 = false
  multi_az                            = false
  backup_retention_period             = var.db_backup_retention_days
  backup_window                       = "02:00-03:00"
  maintenance_window                  = "sun:03:00-sun:04:00"
  auto_minor_version_upgrade          = true
  copy_tags_to_snapshot               = true
  deletion_protection                 = true
  skip_final_snapshot                 = false
  final_snapshot_identifier           = "${local.common_name}-final-snapshot"
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  performance_insights_enabled        = false
  apply_immediately                   = false

  tags = {
    Name = "${local.common_name}-postgres"
  }

  depends_on = [aws_route_table_association.private]
}

resource "aws_iam_role" "lambda" {
  name = "${local.common_name}-lambda-execution"

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
}

resource "aws_iam_role_policy" "lambda_logs" {
  name = "${local.common_name}-lambda-logs"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "${aws_cloudwatch_log_group.lambda.arn}:*"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_vpc" {
  name = "${local.common_name}-lambda-vpc"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_database_auth" {
  name = "${local.common_name}-database-iam-auth"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["rds-db:connect"]
      Resource = "arn:aws:rds-db:${var.aws_region}:${data.aws_caller_identity.current.account_id}:dbuser:${aws_db_instance.postgres.resource_id}/${local.database_username}"
    }]
  })
}


data "aws_iam_role" "vercel_api" {
  name = "ZayviVercelBackendRole"
}

resource "aws_iam_role_policy" "vercel_api_invoke" {
  name = "${local.common_name}-vercel-api-invoke"
  role = data.aws_iam_role.vercel_api.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["execute-api:Invoke"]
      Resource = "${aws_apigatewayv2_api.http.execution_arn}/*/*/*"
    }]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.common_name}-api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.common_name}-api"
  retention_in_days = 30
}

resource "aws_lambda_function" "api" {
  function_name    = "${local.common_name}-api"
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = "${path.module}/zayvi-api-bootstrap.zip"
  source_code_hash = filebase64sha256("${path.module}/zayvi-api-bootstrap.zip")
  timeout          = var.lambda_timeout_seconds
  memory_size      = var.lambda_memory_mb
  publish          = false

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST      = aws_db_instance.postgres.address
      DB_PORT      = tostring(aws_db_instance.postgres.port)
      DB_NAME      = "zayvi"
      DB_USER      = local.database_username
      DB_AUTH_MODE = "iam"
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_logs,
    aws_iam_role_policy.lambda_vpc,
    aws_iam_role_policy.lambda_database_auth,
    aws_cloudwatch_log_group.lambda
  ]

  tags = {
    Name = "${local.common_name}-api"
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.common_name}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["authorization", "content-type", "idempotency-key"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = ["https://zayvi.store", "https://www.zayvi.store"]
    max_age       = 300
  }

  tags = {
    Name = "${local.common_name}-http-api"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_route" "default" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "$default"
  authorization_type = "AWS_IAM"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      requestTime      = "$context.requestTime"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      integrationError = "$context.integrationErrorMessage"
      sourceIp         = "$context.identity.sourceIp"
    })
  }
}

resource "aws_lambda_permission" "allow_api_gateway" {
  statement_id  = "AllowExecutionFromHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_cloudwatch_metric_alarm" "api_errors" {
  alarm_name          = "${local.common_name}-lambda-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }
}

output "api_endpoint" {
  description = "Preview API Gateway endpoint. Bootstrap returns HTTP 503 until application routes are implemented."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "database_endpoint" {
  description = "Private RDS endpoint; reachable only from the authorised Lambda security group."
  value       = aws_db_instance.postgres.address
}

output "database_resource_id" {
  description = "RDS resource identifier used to scope IAM database authentication."
  value       = aws_db_instance.postgres.resource_id
}

output "region" {
  value = var.aws_region
}
