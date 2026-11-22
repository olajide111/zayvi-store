# Owner sign-in verification and completion

Status: token-pair verification and the completion coordinator are implemented; no HTTP or live owner-session integration is activated.

`createOwnerLoginIdentityVerifier` in `lib/owner-identity.ts` verifies both returned JWTs using the configured London pool's trusted keys. The access token must have the expected client, scope and purpose. The ID token must target exactly the configured client and have the expected nonce. Both must share the same subject, provider session and authentication time. Separate ID/access signing keys are supported. When an at_hash claim is present, its access-token binding is checked. Session expiry is limited to the earlier verified token expiry.

Signature checks do not establish current revocation status or MFA. A mandatory server-side assurance adapter receives the verified session identifiers and tokens and must check those facts before returning active/MFA assurance. Missing assurance or an outage denies sign-in; token role/amr fields cannot substitute for it. No such live adapter is configured by this module.

`lib/owner-login-completion.ts` supplies the `finishVerifiedSignIn` coordinator for the PKCE flow. It accepts only a trusted server tenant/store binding, calls the token-pair verifier, resolves organisation membership and runs the existing store-access pipeline. A session handle is generated only inside the authorised store transaction. The session writer receives the SHA-256 hash of that random handle, verified identity/store context and provider session identifiers, never raw JWTs. The handle is returned only after the transaction successfully commits.

The caller must connect a real session writer to the same active transaction client. Independent commits are not permitted. A session load/logout/revocation repository and workspace guards must be implemented before any HTTP adapter uses the returned handle. Requests must recheck current membership, store status and provider revocation. Existing shared-password admin cookies are not minted or changed.

Validation includes real RSA-signed token-pair tests for trusted but different signing keys, nonce/client/subject/session mismatches, expiry, algorithm constraints and rejected MFA-looking claims. Coordinator tests cover verification-before-discovery, revoked/cross-store denial, hash-only writes, transaction ordering and commit failure. These tests do not establish a live Cognito, HTTP-cookie or RDS session flow.

References: [Cognito ID token](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-id-token.html), [OpenID Connect token validation](https://openid.net/specs/openid-connect-core-1_0-errata2.html#IDTokenValidation).
