# Persistent owner sessions and HTTP handlers

Status: server repositories, access orchestration and HTTP handler factory implemented and tested. No public routes, SQL deployment or owner sign-in activation is enabled.

## Session storage and access

`lib/owner-sessions.ts` implements the transactional writer required by the sign-in completion coordinator, capability lookup and local revocation. PostgreSQL stores the SHA-256 hash of the random opaque cookie handle, verified tenant/store/membership context, authentication time and provider identifiers. Raw access, ID and refresh tokens are not stored. Sessions expire no later than the already-verified token pair, with a one-hour database cap.

`database/proposals/owner-sessions.sql` depends on the identity-directory and login-attempt proposals. It remains outside automatic migrations. The table is private to a separate non-login, non-superuser, non-BYPASSRLS executor. The API can call restricted functions but cannot read/write the table directly. Creation requires matching transaction-local tenant context, active membership and an available store. Foreign keys prevent cross-tenant store/membership references. Expired records are cleaned in bounded batches on new session creation.

A session lookup is not an access grant. `lib/owner-session-access.ts` checks the trusted server store/tenant binding and requires current provider revocation/MFA assurance. It then uses the existing tenant/store pipeline to recheck membership, permission and store availability. The stored membership and role must still match; role changes deny old sessions while they differ. Permanent invalidation requires explicit revocation.

Inside that same transaction, the final session check locks the unrevoked/unexpired row before the protected operation. Logout after an initial lookup therefore cannot slip past the final check. A revocation concurrent with an already-authorised operation waits for its transaction to finish. Actual multi-connection lock behaviour must still be verified on RDS; embedded tests cover the sequential revocation race and the existing mock-client suite covers async context isolation.

Local logout revokes only the presented session and is idempotent. It does not claim to revoke Cognito's hosted-login session or refresh-token family. A trusted provider-assurance adapter remains mandatory on requests; no constant-true fallback is supplied.

## HTTP factory

`lib/owner-auth-http.ts` supplies Web Request/Response handlers for start, callback, status and logout. No `app/api` routes import or mount them yet. The factory is disabled by default and requires an explicitly configured durable limiter and authorisation service before use.

- Start/logout require same-origin POST. Callback/status use GET. The public HTTPS origin is pinned in server configuration rather than trusted from request headers.
- Browser binding and session cookies use the `__Host-` prefix, Path=/, Secure, HttpOnly and SameSite=Lax without a Domain attribute. The binding lasts ten minutes; owner-cookie lifetime is capped by stored session expiry.
- Callback clears its binding on success/failure and sets an owner cookie only after completion and session lookup. Errors reveal no provider diagnostics and do not clear an existing owner cookie.
- Status executes current server authorisation and exposes only an authenticated boolean.
- Logout revokes server state before clearing cookies. If revocation fails, it does not claim successful sign-out.
- Responses use no-store and no-referrer. Request logging must also omit callback query values and token bodies.

## Activation dependencies

1. Review role ownership, grants, policies and retention for all proposals; promote them into new reviewed migrations and apply only through the Preview saved-plan process. Historical migrations and production settings remain unchanged.
2. Place the database adapters on the private AWS database path. Vercel must not be given public RDS access or a generic SQL-forwarding endpoint. Review the typed application RPC and provider/JWKS network path before runtime wiring.
3. Configure the actual Cognito pool/client/domain/scopes, callback origin, MFA evidence and provider revocation source. Connect them to the prepared token verifiers; no live provider resources are created here.
4. Compose login attempts, token-pair verification, completion and session repository with the same tenant transaction runner. Mount the HTTP handlers with a real durable limiter, a sign-in/error page and `authorise` implemented through `createOwnerSessionAccess` using `store.read`.
5. Update owner workspace guards and protected API operations to use current owner authorisation. Do not mint the legacy shared-password cookie or assume the existing admin guard accepts owner cookies.
6. Verify browser cookies, host/proxy origin handling, callback failures, logout, revocation, RDS grants/locking and provider outages before enabling owner sign-in or selling.

Validation: `npm run test:store-access` covers secure HTTP behavior and embedded PostgreSQL persistence, hash-only storage, direct-table denial, rollback, expiry, role changes, paused stores, provider/MFA denial, single-session logout and revocation after initial lookup. Browser and live provider/RDS integration verification remain pending.
