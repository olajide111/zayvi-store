# Protected owner store summary

Status: a named read operation is implemented and tested locally. No routes, migrations, IAM grants, secrets or sign-in activation are included.

`createRemoteOwnerStoreSummary` accepts an opaque web-side session handle, loads the existing session metadata and requires a current provider/MFA assurance adapter. It signs a dedicated HS256 proof bound to that session hash, issuer, subject, provider session/token identifiers, authentication time, session expiry, trusted tenant/store and the exact `owner.store.summary` operation. The proof lasts at most 15 seconds and uses a separate 32-byte key. Raw cookie handles and provider JWTs are never sent to the private service. No configuration or constant-true assurance adapter is supplied by this change.

`createPrivateOwnerStoreSummary` verifies the proof before database work. It uses the original `createOwnerSessionAccess` guard with hash-based private session adapters. That guard discovers membership, starts the restricted tenant transaction and checks current membership, `store.read` permission, store status and the session's active state. The session row's shared lock remains held through the store summary query and transaction commit. Provider identifiers in the proof must match the current stored session. A proof that expires while database checks run is rejected before the data read.

The fixed, parameterised query selects only the pinned store's id, name, slug and status. The returned DTO excludes session metadata, membership identifiers and roles. The caller cannot select SQL, a tenant, a store, a permission or another operation. Invalid results, transport failure and denied access become generic failures without internal details. Adapters copy trusted configuration and proof keys at construction; messages cannot change them.

This operation is read-only. Replaying the same still-valid proof can repeat this read, but it cannot create or mutate a session or store. There is no automatic retry or result cache. Future write operations need their own named permissions, operation-bound messages and idempotency design; do not generalise this into a SQL-forwarding endpoint.

## Activation still required

The eventual private entry must authenticate the reviewed web IAM role and pin Preview deployment, account, region and function. Enforce input size/timeouts, disable transport retries and keep the proof key private. Do not expose this dispatcher through the public gateway or payment webhook. Proofs and session identifiers must not appear in logs or browser responses.

The public-network server must use the actual current Cognito session/MFA assurance integration before signing. The tests inject an assurance adapter; this is not evidence of a completed live MFA challenge. A signed proof establishes trust in that web server's statement, not independent provider verification by the private Lambda. Provider revocation can occur after issuance; the short proof lifetime bounds that gap, while local session revocation is checked again in PostgreSQL.

Review/promote existing SQL proposals, configure restricted IAM/private transport and the durable limiter, provision the exact pilot membership, and pass browser/provider/RDS checks before mounting owner sign-in. Other catalogue, order and settings operations still need separate named interfaces before the owner dashboard can use them. No owner route is mounted here.

## Evidence

Embedded PostgreSQL tests use the existing SQL proposals and restricted application role. They verify that the data read happens after transaction-local session checks and commits before reply; reject forged, expired, overlong, cross-store and wrong-operation proofs; deny revoked sessions, removed/changed membership and paused stores; check provider-session substitution, lost replies and proof expiry during database work. Existing direct-session, lifecycle and limiter tests remain passing. Multi-connection RDS locking, IAM/network behaviour and live provider assurance remain unverified.
