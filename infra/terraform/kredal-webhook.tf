variable "kredal_preview_webhook_secret_arn" {
  description = "ARN of the existing Secrets Manager secret containing the raw Kredal test webhook signing secret. Null leaves the public webhook route disabled."
  type        = string
  default     = null

  validation {
    condition = var.kredal_preview_webhook_secret_arn == null || can(regex(
      "^arn:aws:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:[A-Za-z0-9/_+=.@-]+$",
      var.kredal_preview_webhook_secret_arn
    ))
    error_message = "Provide the complete ARN of a Secrets Manager secret."
  }
}

locals {
  kredal_webhook_enabled = var.kredal_preview_webhook_secret_arn != null
  kredal_webhook_path    = "/api/payments/kredal/webhook"
  kredal_webhook_name    = "${local.common_name}-kredal-webhook"
}

data "archive_file" "kredal_webhook" {
  count       = local.kredal_webhook_enabled ? 1 : 0
  type        = "zip"
  output_path = "${path.module}/zayvi-kredal-webhook.zip"

  source {
    content  = file("${path.module}/../kredal-webhook/index.js")
    filename = "index.js"
  }

  source {
    content  = file("${path.module}/../../lib/kredal-signature.cjs")
    filename = "kredal-signature.cjs"
  }
}

resource "aws_iam_role" "kredal_webhook" {
  count = local.kredal_webhook_enabled ? 1 : 0
  name  = local.kredal_webhook_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "kredal_webhook" {
  count             = local.kredal_webhook_enabled ? 1 : 0
  name              = "/aws/lambda/${local.kredal_webhook_name}"
  retention_in_days = 30
}

resource "aws_iam_role_policy" "kredal_webhook" {
  count = local.kredal_webhook_enabled ? 1 : 0
  name  = local.kredal_webhook_name
  role  = aws_iam_role.kredal_webhook[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.kredal_webhook[0].arn}:*"
      },
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = var.kredal_preview_webhook_secret_arn
      },
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = aws_lambda_function.api.arn
      }
    ]
  })
}

resource "aws_lambda_function" "kredal_webhook" {
  count            = local.kredal_webhook_enabled ? 1 : 0
  function_name    = local.kredal_webhook_name
  role             = aws_iam_role.kredal_webhook[0].arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.kredal_webhook[0].output_path
  source_code_hash = data.archive_file.kredal_webhook[0].output_base64sha256
  timeout          = 25
  memory_size      = 128

  environment {
    variables = {
      KREDAL_WEBHOOK_SECRET_ARN = var.kredal_preview_webhook_secret_arn
      COMMERCE_LAMBDA_NAME      = aws_lambda_function.api.function_name
    }
  }

  depends_on = [aws_iam_role_policy.kredal_webhook]
}

resource "aws_lambda_permission" "kredal_webhook" {
  count         = local.kredal_webhook_enabled ? 1 : 0
  statement_id  = "AllowKredalWebhookRoute"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.kredal_webhook[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/$default/POST${local.kredal_webhook_path}"
}

resource "aws_apigatewayv2_integration" "kredal_webhook" {
  count                  = local.kredal_webhook_enabled ? 1 : 0
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.kredal_webhook[0].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 27000
}

resource "aws_apigatewayv2_route" "kredal_webhook" {
  count              = local.kredal_webhook_enabled ? 1 : 0
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST ${local.kredal_webhook_path}"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.kredal_webhook[0].id}"

  depends_on = [aws_lambda_permission.kredal_webhook]
}

output "kredal_preview_webhook_url" {
  description = "Register this URL for test-mode Kredal webhook deliveries."
  value       = local.kredal_webhook_enabled ? "${aws_apigatewayv2_api.http.api_endpoint}${local.kredal_webhook_path}" : null
}
