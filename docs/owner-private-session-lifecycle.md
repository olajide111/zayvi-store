# Private owner session lifecycle

Status: service core and restricted PostgreSQL tests implemented. No routes, IAM grants, secrets, migrations or sign-in activation are included.

`createRemoteOwnerSessionLifecycle` provides the web handler's session `load` and `revoke` dependencies through a typed private interface. It hashes the opaque session handle before transport. Requests contain only a version, one named operation and a SHA-256 session hash. Raw cookie handles and provider access/ID tokens never cross this boundary. Lookup replies contain confidential session metadata for server-side provider checks; never return them to a browser or log them.

Both adapters copy and pin Preview deployment, the exact London Cognito issuer and the trusted tenant/store UUIDs. The private dispatcher returns no metadata and performs no revocation for another store, tenant or issuer. The web adapter independently rejects malformed, expired, oversized or mismatched replies. Unknown, expired and revoked sessions resolve to null; repeated logout of the same session is harmless. There is no cross-request lookup cache and no automatic retry. Lost revoke replies fail the HTTP action even if PostgreSQL has already committed the revocation; the next lookup observes database state.

`createPostgresOwnerSessionLifecycle` reuses the existing restricted `resolve_session` and `revoke_session` SQL functions. The original direct session adapter delegates to the same primitive; its creation and transaction-local activity checks are unchanged. No new SQL proposal is necessary for this step.

## Authorisation remains separate

A returned record is not a current role/membership decision or evidence of live provider MFA. Do not implement `authorise` by accepting this lookup. The existing store guard still checks current provider assurance, membership, role, store state and session activity inside the database transaction that executes the operation. The remote lifecycle intentionally exposes no `isActive` shortcut: a network lookup cannot preserve that transaction's session lock. Named private business-operation dispatchers are still required before mounting protected owner workspaces.

## Activation requirements

- A reviewed private Lambda entry must pin account, region, function and Preview deployment, enforce IAM caller identity, bound payload size/timeouts and disable automatic retries. This dispatcher is not network authentication.
- The hash is a confidential session identifier and permits scoped lookup/revocation to its trusted private caller. Never expose this operation through the public commerce gateway, Kredal webhook or a generic SQL endpoint.
- Review/promote the existing session proposals and provision the exact owner membership. Verify transport and restricted database grants on RDS, alongside current Cognito session/MFA assurance and the durable limiter.
- Mount the web handlers only after their private business-operation authoriser, provider checks and browser tests pass. Owner sign-in remains disabled.

Tests use embedded PostgreSQL with the actual existing proposals and restricted application role. They verify raw-handle exclusion, cross-store lookup/revocation rejection, expiry, idempotent logout, independent session handles, uncached reads, lost replies, pinned configuration and malformed-message denial. Existing direct-session tests still verify revocation during a protected operation, role changes and transaction rollback. Live IAM, provider assurance and multi-connection RDS behaviour remain unverified.
