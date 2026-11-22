# Hammy membership resolution

Status: adapter and SQL proposal tested locally; not deployed to Preview.

`lib/tenant-membership-directory.ts` implements the directory interface used by the tenant/store access pipeline. Discovery accepts only the verified issuer and subject from that pipeline, uses parameterised SQL and validates returned memberships. It never establishes identity from an email address, browser role or store name.

`database/proposals/identity-membership-directory.sql` proposes a private identity index and two restricted functions. The index maps issuer/subject to existing tenant and membership IDs. It does not copy roles/status, infer links from legacy subjects, create tenants or transfer owners. Discovery reads current statuses. The transaction recheck verifies exact identity, tenant, membership, original role and MFA assurance, and takes share locks on the matched rows. A downgrade, suspension, removal or changed mapping before this check denies the operation.

The function owner is a dedicated non-login, non-superuser, non-BYPASSRLS role. It has an explicit SELECT RLS policy for membership discovery, column-level SELECT on the required fields and column-level UPDATE only where PostgreSQL requires a write privilege for row locking (membership_id on the index and id on tenant/membership rows). Function bodies do not update rows. The application role is not a member of the resolver role and cannot read or write the private index. Function execution is revoked from PUBLIC and granted only to zayvi_app. Both functions fix their search_path and qualify table references.

The SQL is deliberately outside `database/migrations`: it is not automatically packaged or applied. Before promotion, review RDS role ownership, CREATE ROLE/ALTER OWNER privileges, schema grants, policies and the bootstrap grant script. Existing roles/schema names cause the proposal to fail rather than silently reuse them. No identity records are populated by the proposal.

## Validation

Run `npm run test:store-access` after `npm ci`. This compiles the access/security tests into a temporary directory, runs them and cleans up. Development-only PGlite supplies an embedded PostgreSQL engine without AWS credentials.

The PostgreSQL tests execute migration 0001 (omitting its optional pgcrypto extension statement because gen_random_uuid is built in), then the exact proposal. They switch to a non-privileged application role and verify restricted discovery, denied index reads/writes, cross-tenant RLS, tenant-context cleanup, membership/MFA rechecks, role downgrades, revocation, function grants and cross-tenant foreign-key rejection.

PGlite is not the deployed RDS server. Multi-connection locking, real pooling, IAM/grants, RDS PostgreSQL version compatibility and provider session behavior still need Preview integration tests. Concurrent context separation is also covered by the existing injected-client tests.

## Remaining activation work

1. Review and promote the SQL through a new migration, then apply a saved Preview plan after reviewing its complete scope. Do not edit historical migrations.
2. Provision Hammy's owner link explicitly with a verified issuer/subject and reviewed tenant/store IDs. Ordinary API credentials must not provision directory rows.
3. Configure the provider, sign-in callback and real session revocation/MFA verifier.
4. Connect discovery using the API-only application connection and pass `withTenantClient` from the same store database adapter instance for rechecks.
5. Verify the complete flow on RDS before enabling catalogue writes or checkout. Existing admin-password and legacy main-store routes are not converted by this code.
