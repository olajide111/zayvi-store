# Opt-in Preview identity resources. Does not mount routes or enable owner access.
variable "preview_owner_identity" {
  description = "Reviewed Preview owner-login configuration. Null creates no Cognito resources. Keep configured after activation; resources are protected from accidental destruction."
  type = object({
    origin        = string
    domain_prefix = string
  })
  default = null
  validation {
    condition     = var.preview_owner_identity == null ? true : var.preview_owner_identity.origin == "https://preview.zayvi.store"
    error_message = "This activation is restricted to https://preview.zayvi.store."
  }
  validation {
    condition     = var.preview_owner_identity == null ? true : can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$", var.preview_owner_identity.domain_prefix))
    error_message = "Use a reviewed Cognito domain prefix of 1-63 lowercase letters, digits or internal hyphens."
  }
}

locals {
  owner_identity_enabled = var.preview_owner_identity != null
  owner_preview_origin   = try(var.preview_owner_identity.origin, "")
  owner_preview_domain   = try(var.preview_owner_identity.domain_prefix, "")
}

resource "aws_cognito_user_pool" "preview_owners" {
  count                    = local.owner_identity_enabled ? 1 : 0
  name                     = "zayvi-preview-owners"
  user_pool_tier           = "LITE"
  deletion_protection      = "ACTIVE"
  mfa_configuration        = "ON"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }
  software_token_mfa_configuration {
    enabled = true
  }
  username_configuration {
    case_sensitive = false
  }
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 1
  }
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
  tags = {
    Environment = "Preview"
    Purpose     = "OwnerAuthentication"
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cognito_resource_server" "preview_owners" {
  count        = local.owner_identity_enabled ? 1 : 0
  identifier   = "zayvi"
  name         = "Zayvi Preview owner access"
  user_pool_id = aws_cognito_user_pool.preview_owners[0].id
  scope {
    scope_name        = "store.access"
    scope_description = "Request store access; Zayvi database membership remains authoritative"
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cognito_user_pool_client" "preview_owners" {
  count                                = local.owner_identity_enabled ? 1 : 0
  name                                 = "zayvi-preview-owner-web"
  user_pool_id                         = aws_cognito_user_pool.preview_owners[0].id
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "${aws_cognito_resource_server.preview_owners[0].identifier}/store.access"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = ["${local.owner_preview_origin}/api/owner/auth/callback"]
  logout_urls                          = ["${local.owner_preview_origin}/owner/sign-in"]
  default_redirect_uri                 = "${local.owner_preview_origin}/api/owner/auth/callback"
  enable_token_revocation              = true
  prevent_user_existence_errors        = "ENABLED"
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  access_token_validity                = 60
  id_token_validity                    = 60
  refresh_token_validity               = 60
  auth_session_validity                = 3
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "minutes"
  }
  read_attributes  = ["email", "email_verified"]
  write_attributes = ["email"]
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cognito_user_pool_domain" "preview_owners" {
  count                 = local.owner_identity_enabled ? 1 : 0
  domain                = local.owner_preview_domain
  user_pool_id          = aws_cognito_user_pool.preview_owners[0].id
  managed_login_version = 1 # Classic hosted UI is supported by the Lite tier.
  lifecycle {
    prevent_destroy = true
  }
}

output "preview_owner_identity" {
  description = "Non-secret Preview provider identifiers. Does not indicate owner sign-in is enabled."
  value = local.owner_identity_enabled ? {
    user_pool_id  = aws_cognito_user_pool.preview_owners[0].id
    client_id     = aws_cognito_user_pool_client.preview_owners[0].id
    issuer        = "https://cognito-idp.eu-west-2.amazonaws.com/${aws_cognito_user_pool.preview_owners[0].id}"
    domain_prefix = local.owner_preview_domain
    origin        = local.owner_preview_origin
    callback_url  = "${local.owner_preview_origin}/api/owner/auth/callback"
    scope         = "zayvi/store.access"
    runtime_ready = false
  } : null
}
