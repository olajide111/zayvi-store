# Tenant Context and API Security Contract

**Status:** Required design contract for multi-tenant implementation
**Applies to:** Storefront, admin, APIs, background jobs and integrations

## 1. Trusted tenant resolution

Tenant identity is established server-side:
1. Resolve a verified custom hostname to an active store and tenant, or resolve authenticated user identity to an active tenant membership and selected store.
2. For background jobs and webhooks, resolve tenant from a verified integration credential/event mapping.
3. Confirm tenant and store are active and caller has the required permission.
4. Create request-scoped tenant context and set the PostgreSQL tenant setting inside the same database transaction.

A tenant_id, store_id, role, owner flag or permission supplied by the browser is never proof of access. The server validates it against authenticated membership and store ownership.

## 2. Request context
- request/correlation ID;
- authenticated identity subject;
- tenant ID and optional store ID;
- membership ID and permission set;
- authentication method and MFA assurance;
- resolved market and locale;
- integration identity where applicable.

Construct this context in trusted server code. Never accept arbitrary context objects from client JSON.

## 3. Authorization model

Use central permission checks rather than scattered role-name comparisons. Suggested permission keys:
- tenant.read, tenant.update, tenant.members.manage;
- store.read, store.create, store.update, store.domain.manage;
- catalogue.read, catalogue.write, catalogue.publish;
- supplier.read, supplier.manage, supplier.verify;
- inventory.read, inventory.manage;
- orders.read, orders.manage, refunds.manage;
- finance.read, finance.manage;
- intelligence.read, intelligence.run;
- integrations.manage, api_keys.manage;
- subscriptions.read, subscriptions.manage;
- audit.read, data.export;
- platform.support_access.

Roles map to permissions in a central, versioned policy. Tenant owners cannot grant platform-operator privileges. Support access is separate, time-bound, reason-coded and audited.

## 4. Database transaction rules
- Use a dedicated application database role with no superuser or BYPASSRLS privileges.
- Begin a transaction for each unit of work.
- Set tenant context using parameterised set_config('app.tenant_id', tenant_uuid, true) only after authorization.
- Ensure pooled transactions are committed or rolled back before connection reuse.
- Apply tenant predicates in application queries as defence in depth; PostgreSQL RLS is an additional boundary.
- Never use a session-level tenant setting that can leak between requests.
- Tenant creation and initial owner membership require a narrowly scoped provisioning path.
- Global plan, taxonomy and market reference data must be explicitly identified as global and read-only to ordinary tenant roles.

## 5. API conventions
- Version public APIs under /api/v1.
- Return consistent errors with stable machine-readable codes.
- Use idempotency keys for order creation, payment operations and webhook processing.
- Use bounded pagination.
- Validate input schemas on the server.
- Rate-limit login, search, checkout, API keys and expensive intelligence operations.
- Never return supplier private evidence, secrets, other tenants' records or internal risk notes to storefront customers.

## 6. Example route contract

| Route | Purpose | Required permission/context |
|---|---|---|
| GET /api/v1/storefront/context | Resolve public store, theme and market options | Verified host; public-safe fields only |
| GET /api/v1/storefront/products | List published products for selected market | Verified host + market; published market records only |
| GET /api/v1/storefront/products/:slug | Product detail | Verified host + market; published market offer |
| POST /api/v1/cart/items | Add/update cart item | Store context + validated product-market |
| POST /api/v1/checkout/session | Create provider checkout session | Store context; server-side basket/price validation |
| GET /api/v1/tenant/stores | List tenant stores | Authenticated membership |
| POST /api/v1/tenant/stores | Create store | store.create |
| POST /api/v1/tenant/invitations | Invite team member | tenant.members.manage |
| GET /api/v1/tenant/audit-events | View audit events | audit.read |
| GET /api/v1/tenant/usage | View plan and usage | subscriptions.read |
| POST /api/v1/intelligence/assessments | Run product-market assessment | intelligence.run + entitlement |
| POST /api/v1/integrations/webhooks/:provider | Receive provider event | Signature verification + integration mapping |

These are target contracts, not currently implemented endpoints.

## 7. Required security tests
1. Anonymous user cannot access tenant admin APIs.
2. User in tenant A cannot read, update or delete tenant B data by changing IDs or slugs.
3. Tenant A cannot attach a store, order, product or membership belonging to tenant B.
4. Storefront hostname cannot resolve to an unverified or disabled domain.
5. A tenant cannot access private media from another tenant.
6. Suspended tenant and removed membership are denied immediately.
7. Role downgrade/revocation takes effect without stale authorization.
8. Support access requires explicit grant, expiry and audit record.
9. RLS denies reads and writes when tenant context is missing or invalid.
10. A pooled connection cannot retain the previous request's tenant setting.
11. Entitlement limits are enforced server-side.
12. Webhook replay and duplicate payment/order events are idempotently handled.

## 8. Rollout gates

Do not onboard external tenants until a dedicated non-superuser application DB role exists; RLS and cross-tenant tests pass against PostgreSQL; authentication, MFA and permissions are implemented; tenant creation and support access are audited; domain verification is secure; privacy/export/deletion and incident response procedures are documented; and Preview passes automated and manual acceptance testing.