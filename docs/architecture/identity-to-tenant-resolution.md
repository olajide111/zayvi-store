# Identity-to-Tenant Resolution and Bootstrap

**Status:** Implementation specification; not yet implemented
**Applies to:** Authentication, tenant selection, membership provisioning and PostgreSQL RLS
**Decision:** Use a managed identity provider (AWS Cognito is the preferred AWS-aligned candidate), while keeping tenant membership and application permissions in Zayvi's database.

## 1. The bootstrap problem

Tenant-scoped RLS cannot be the first step in resolving a user's tenant. The application authenticates an external identity first, then needs a narrowly controlled way to discover which tenant memberships belong to that identity. Only after the user selects an authorised tenant can the application establish `app.tenant_id` inside a transaction.

Never solve this by accepting a tenant ID, role or membership ID as trusted browser input.

## 2. Required identity model

- The identity provider authenticates the person and issues a signed token.
- The API validates token signature, issuer, audience, expiry and required assurance.
- The stable provider subject (issuer + subject, not email) identifies the person.
- Zayvi stores tenant memberships and role assignments separately from identity-provider groups.
- Email is a mutable contact attribute, not a primary identity key.
- One identity may belong to multiple tenants; each membership is independently active, suspended or removed.

The provider subject must be namespaced by issuer, for example `issuer + subject`, to prevent collisions if providers change.

## 3. Safe membership discovery

Introduce a small global identity-to-membership directory in a dedicated schema. It contains only the provider issuer, provider subject, tenant ID and membership ID needed to discover a user's memberships.

Controls:
1. The application DB role receives no direct SELECT, INSERT, UPDATE or DELETE privilege on this directory.
2. A narrowly scoped SECURITY DEFINER function returns only memberships for the exact authenticated issuer/subject arguments.
3. The function uses a fixed search_path, validates non-empty arguments, exposes no dynamic SQL, and is owned by a dedicated non-login role with only the required directory and membership lookup privileges.
4. The function returns tenant status, membership status and safe display metadata; it never returns secrets or private tenant records.
5. Revoke EXECUTE from PUBLIC and grant it only to the authenticated API database role.
6. Rate-limit membership discovery and audit tenant selection.
7. The API must pass issuer/subject from a successfully validated token, never from request JSON.

The directory is a controlled authentication index, not a replacement for tenant RLS. Its function and grants require security review and tests before deployment.

## 4. Request sequence

1. Validate the identity-provider token.
2. Call the restricted membership-discovery function with the validated issuer and subject.
3. Reject users with no active membership; show only active tenant choices to users with multiple memberships.
4. Validate the selected tenant against the function result and re-check tenant and membership status.
5. Resolve store access and central permission policy server-side.
6. Start a database transaction.
7. Set tenant context transaction-locally with parameterised `set_config('app.tenant_id', $1, true)`.
8. Perform tenant-scoped reads/writes. RLS and explicit tenant predicates both apply.
9. Commit or roll back before returning the pooled connection.

The selected tenant ID is a request selector only. It becomes trusted context only after the server validates the membership.

## 5. Provisioning and invitation

- Tenant creation is a platform-controlled operation, not an ordinary tenant API insert.
- The initial owner membership is created atomically with the tenant and identity-directory row.
- Invitations are single-use, expiring, hashed tokens delivered to the intended email address.
- Accepting an invitation requires an authenticated identity and a verified email match or an explicitly approved identity-linking flow.
- A user cannot create their own owner membership by changing a request body.
- Role changes, invitations, removals and tenant suspension are audited.
- Email changes must not silently transfer identity ownership.

## 6. Provider decision

AWS Cognito is the preferred candidate because it aligns with the AWS deployment direction. Before choosing it, verify UK/EU data-residency requirements, MFA and passkey support, hosted/custom UI options, account recovery, pricing, token lifecycle, domain setup and integration effort. Do not provision a billable user pool until the configuration and expected cost are approved.

Keep the application authentication adapter provider-neutral so a future provider migration does not change tenant permission or RLS logic.

## 7. Required tests

1. Invalid, expired, wrong-issuer and wrong-audience tokens cannot discover memberships.
2. A user cannot enumerate another identity's memberships by changing request parameters.
3. Email changes do not change the stable identity subject.
4. A removed or suspended membership is not returned as active.
5. A suspended tenant cannot be selected.
6. A user with two tenants can select only one of their own active memberships.
7. A browser-supplied tenant ID without a matching membership is denied.
8. The application DB role cannot query the identity directory directly.
9. SECURITY DEFINER function has a fixed search_path and minimal grants.
10. Missing tenant context denies tenant-table access.
11. Tenant context is transaction-local and does not leak through pooled connections.
12. Cross-tenant foreign-key references fail even if an ID is guessed.

## 8. Implementation gates

Do not expose external tenant signup or admin access until the identity provider is configured, token validation is implemented, membership discovery and provisioning are reviewed, permission checks are centralised, the database migration is tested against the selected PostgreSQL version, and RLS tests pass using the actual non-superuser application role.
