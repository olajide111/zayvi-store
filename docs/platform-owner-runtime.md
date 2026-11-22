# Preview owner authentication runtime

Status: composed and tested locally. The operator has provisioned the dedicated Preview Cognito resources and supplied a passing configuration preflight. No authentication routes are mounted and no database proposals are applied by this change.

`lib/owner-auth-runtime.ts` connects the existing login, encrypted attempt repository, signed token-pair verifier, membership directory, transactional session writer, HTTP handlers and protected store-operation authoriser. It is shared platform infrastructure; Hammy can supply its separate navigation context and trusted tenant/store binding as the first pilot. The retained Store Templates baseline is unchanged.

## Runtime contract

Activation requires both `mode: "preview"` and `deployment: "preview"` in trusted server configuration. Other deployment values return disabled handlers and deny protected operations without constructing database/provider adapters. This Preview path cannot activate production.

An enabled runtime requires restricted database connections, a dedicated encryption key, current provider/MFA assurance for login and subsequent requests, and a durable rate limiter. There is no permissive assurance or rate-limit fallback. The provider pool/client/scopes, origin and store binding come from server configuration, never request fields. The navigation context only controls login intent and permitted destinations; it does not grant store access.

The returned `handlers` are start, callback, status and logout Web handlers. `authorise` runs a named permitted operation inside the current tenant/store transaction after session, membership and provider checks. Exporting this factory does not mount Next.js routes or replace existing admin authentication.

## Verification

`tests/owner-auth-runtime.test.ts` composes all these modules using embedded PostgreSQL with the actual proposal SQL, real RSA-signed access/ID tokens and Web requests/responses. It checks PKCE exchange, nonce rejection, one-use callbacks, committed sessions, current provider and membership denial, foreign-store denial, rate limiting and logout. The complete store-access suite has 99 passing tests.

The exchange transport, provider assurance and limiter in this test are test doubles. Passing proves local composition, not live Cognito MFA/revocation, a production limiter, browser behaviour or multi-connection RDS locking.

## Preview activation still required

The existing private database Lambda has no NAT gateway/default outbound route. It cannot simply call public provider token/JWKS endpoints. Vercel cannot directly connect to private RDS. Review runtime placement and a typed application RPC boundary before activation; do not expose RDS publicly or add a generic SQL-forwarding endpoint.

The first [typed private boundary](owner-private-attempt-boundary.md) now separates encrypted login-attempt persistence from its web-side encryption. It is tested locally and is not mounted or a replacement for the remaining transactional session/membership boundary.

The remaining work is to configure and verify the real provider and network path, review/promote the three SQL proposals as new migrations, supply a durable limiter and provider assurance, mount the handlers/sign-in page, and migrate protected workspace/API guards. Review a saved Preview infrastructure plan before applying it. Preserve the webhook-secret and alarm-topic inputs. Browser/provider/RDS integration checks must pass before enabling the pilot.

No real payments, fulfilment, production configuration or existing theme is changed here.

Use the [read-only Preview configuration check](preview-owner-activation.md) to inventory existing pools and inspect a selected client before preparing any infrastructure activation. A matching metadata report does not enable this runtime.
