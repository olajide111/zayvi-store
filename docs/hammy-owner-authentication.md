# Hammy owner authentication

Status: verification adapter implemented; provider, sign-in flow and membership discovery not activated.

`lib/owner-identity.ts` prepares the Cognito path described in the identity architecture. It verifies signed access tokens using the exact server-configured London user pool, client ID and required scopes. It accepts RS256 only, enforces token time claims and token purpose, and rejects ID tokens and machine-client subjects. Signing keys come from the configured pool's JWKS URL; token headers cannot select a key server. The `jose` dependency is explicit and pinned in the package lock.

The adapter requires a server-side session verifier. This must check that the exact signed subject, token ID and session ID remain active and that the session has verified MFA assurance. It must use a real revocation/assurance store or a reviewed provider integration. Returning constant `true` is not an implementation. A signed token, an `amr` field or a browser claim alone does not establish this assurance. An outage or missing MFA denies access.

Verified identity contains only issuer, subject, authentication time and assurance. It grants no owner role, tenant membership or store rights. Resolve those through the database membership directory and `withAuthorisedStore` after identity verification.

## Remaining connection work

- Review and configure the actual Cognito pool, app client, scopes, session/revocation strategy and MFA flows in Preview. No resources are provisioned by this module.
- Implement the browser sign-in/return flow with state, nonce where applicable, PKCE and secure session handling. The shared admin-password cookie is not an identity-provider token.
- Implement and verify the restricted issuer/subject membership-discovery function described in `architecture/identity-to-tenant-resolution.md`.
- Connect the membership recheck, session verifier and database runner, then prove cross-tenant access denial with actual non-privileged PostgreSQL credentials.
- Bind Hammy's independent store UUID and exercise owner sign-in, logout/revocation, recovery and MFA before enabling data changes or checkout.

Validation: eight tests use generated RSA keys and signed JWTs to check acceptance, forged signatures, unknown keys, ID/machine tokens, wrong pool/client/audience, expired/future/missing claims, scopes, revoked sessions, missing MFA, provider failures and algorithm substitution. These are local cryptographic tests, not a live Cognito sign-in test.

References: [AWS Cognito token verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html), [jose verification options](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md), [trusted remote signing keys](https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md).
