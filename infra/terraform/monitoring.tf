variable "operational_alarm_topic_arn" {
  description = "Optional existing SNS topic in this Preview account and region. Null records alarms in CloudWatch without sending notifications."
  type        = string
  default     = null
  validation {
    condition     = var.operational_alarm_topic_arn == null || can(regex("^arn:aws:sns:eu-west-2:001961766018:[A-Za-z0-9_-]+$", var.operational_alarm_topic_arn))
    error_message = "Use an existing London SNS topic in account 001961766018."
  }
}

locals {
  operational_alarm_actions = var.operational_alarm_topic_arn == null ? [] : [var.operational_alarm_topic_arn]
  monitored_functions = merge(
    { commerce = { name = aws_lambda_function.api.function_name, timeout = var.lambda_timeout_seconds } },
    local.kredal_webhook_enabled ? { webhook = { name = aws_lambda_function.kredal_webhook[0].function_name, timeout = 25 } } : {}
  )
  application_log_groups = merge(
    { commerce = { name = aws_cloudwatch_log_group.lambda.name, marker = "commerce_server_error" } },
    local.kredal_webhook_enabled ? { webhook = { name = aws_cloudwatch_log_group.kredal_webhook[0].name, marker = "kredal_webhook_server_error" } } : {}
  )
  database_alarms = {
    storage = { metric = "FreeStorageSpace", operator = "LessThanThreshold", threshold = 5 * 1024 * 1024 * 1024, statistic = "Minimum" }
    memory  = { metric = "FreeableMemory", operator = "LessThanThreshold", threshold = 128 * 1024 * 1024, statistic = "Minimum" }
    cpu     = { metric = "CPUUtilization", operator = "GreaterThanThreshold", threshold = 85, statistic = "Average" }
  }
}

# Handled HTTP 5xx responses are not Lambda runtime errors. Include direct Lambda
# commerce requests, which do not pass through API Gateway, using a log marker.
resource "aws_cloudwatch_log_metric_filter" "application_failures" {
  for_each       = local.application_log_groups
  name           = "${local.common_name}-${each.key}-server-errors"
  log_group_name = each.value.name
  pattern        = "\"${each.value.marker}\""
  metric_transformation {
    name          = "${local.common_name}-${each.key}-server-errors"
    namespace     = "Zayvi/Preview"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "application_failures" {
  for_each            = local.application_log_groups
  alarm_name          = "${local.common_name}-${each.key}-server-errors"
  alarm_description   = "Handled server errors. Inspect the corresponding Lambda logs; no payment or customer payload is included in the marker."
  namespace           = "Zayvi/Preview"
  metric_name         = aws_cloudwatch_log_metric_filter.application_failures[each.key].metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.operational_alarm_actions
  ok_actions          = local.operational_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each            = local.monitored_functions
  alarm_name          = "${local.common_name}-${each.key}-throttles"
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = each.value.name }
  alarm_actions       = local.operational_alarm_actions
  ok_actions          = local.operational_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each            = local.monitored_functions
  alarm_name          = "${local.common_name}-${each.key}-duration"
  alarm_description   = "Execution exceeded 80 percent of its timeout in two of three minutes."
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = each.value.timeout * 800
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = each.value.name }
  alarm_actions       = local.operational_alarm_actions
  ok_actions          = local.operational_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "webhook_runtime_errors" {
  count               = local.kredal_webhook_enabled ? 1 : 0
  alarm_name          = "${local.common_name}-webhook-runtime-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.kredal_webhook[0].function_name }
  alarm_actions       = local.operational_alarm_actions
  ok_actions          = local.operational_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "gateway_server_errors" {
  alarm_name          = "${local.common_name}-gateway-server-errors"
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  dimensions          = { ApiId = aws_apigatewayv2_api.http.id, Stage = aws_apigatewayv2_stage.default.name }
  alarm_actions       = local.operational_alarm_actions
  ok_actions          = local.operational_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "database_pressure" {
  for_each            = local.database_alarms
  alarm_name          = "${local.common_name}-database-${each.key}"
  namespace           = "AWS/RDS"
  metric_name         = each.value.metric
  statistic           = each.value.statistic
  period              = 300
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  comparison_operator = each.value.operator
  threshold           = each.value.threshold
  treat_missing_data  = "missing"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.postgres.identifier }
  alarm_actions       = local.operational_alarm_actions
  ok_actions          = local.operational_alarm_actions
}

output "operational_monitoring" {
  description = "Alarm names and whether an existing notification topic is configured. No topic means CloudWatch visibility only."
  value = {
    notifications_configured = var.operational_alarm_topic_arn != null
    alarms = concat(
      [aws_cloudwatch_metric_alarm.api_errors.alarm_name, aws_cloudwatch_metric_alarm.gateway_server_errors.alarm_name],
      [for alarm in aws_cloudwatch_metric_alarm.application_failures : alarm.alarm_name],
      [for alarm in aws_cloudwatch_metric_alarm.lambda_throttles : alarm.alarm_name],
      [for alarm in aws_cloudwatch_metric_alarm.lambda_duration : alarm.alarm_name],
      [for alarm in aws_cloudwatch_metric_alarm.database_pressure : alarm.alarm_name],
      aws_cloudwatch_metric_alarm.webhook_runtime_errors[*].alarm_name
    )
  }
}
