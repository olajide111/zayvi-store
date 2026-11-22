# Private session completion

Status: implemented and tested locally; no routes, Lambda entry point, IAM grants, secrets or migrations are activated by this change.

## Handoff

The public-network server verifies the provider token pair, nonce and current MFA/revocation assurance using the existing identity verifier. It generates a random session handle and signs a short-lived statement containing only the handle's hash, verified provider identity/session identifiers, authentication time, session expiry and the trusted tenant/store binding. Raw provider tokens and the raw session handle do not cross the private completion boundary. Proofs are confidential server messages and must not be logged or sent to browsers.

`lib/owner-session-completion-rpc.ts` uses JOSE HS256 with a dedicated 32-byte proof key, separate from login-attempt encryption, admin cookies, platform keys and webhook secrets. Both adapters require explicit Preview configuration. The verifier pins issuer, audience, type, algorithm, provider issuer and store binding; it rejects expired proofs, lifetimes over 30 seconds, extra fields and caller-supplied roles. Runtime secrets must come from the reviewed server secret path. No secret value is committed or created here.

After proof verification, the private service runs the existing membership discovery, permission check, transaction-local RLS checks, current membership/role/store checks and session insertion. It derives the role and membership from PostgreSQL. `createVerifiedOwnerSessionWriter` shares this transaction with the original direct completion adapter, so local and remote paths cannot independently commit a session before authorisation finishes.

The proof's ID is the proposed session hash. The database primary key prevents a replay from creating another session. Both services must disable automatic completion retries. If the database commits but the reply is lost, the web service returns no handle and sign-in starts again; the inaccessible session expires normally. This avoids treating a network timeout as permission to mint another session.

## Deployment work still required

The dispatcher is a service core, not a network authentication mechanism. Its eventual Lambda entry must restrict invocation to the reviewed IAM server role, require Preview deployment, pin account/function/region and bound payload sizes/timeouts. Do not expose this operation through a public gateway or payment webhook. Do not pass arbitrary SQL or database transaction callbacks across RPC.

No proof key is configured yet. Shared-key signing is a server trust boundary, not proof of provider MFA by itself: the signer must run the real token verifier and provider assurance adapter before signing. Local tests inject provider assurance, while separately testing the cryptographic handoff and real proposal SQL. Live Cognito assurance, durable limiting, typed session lookup/revocation and protected operation handlers, migration/pilot membership activation, IAM transport and actual browser/RDS verification remain pending. Authentication stays disabled.

## Checks

The full store-access suite passes 112 tests, including ten new completion tests/subtests against embedded PostgreSQL using its restricted application role. Coverage includes commit before returning a handle, replay, failed provider verification, forged/expired/wrong-binding/missing-MFA proofs, removed membership, paused stores, current database roles, rollback after insertion, lost replies and malformed responses. Embedded PostgreSQL does not prove real RDS multi-connection locking or IAM/network behaviour.
