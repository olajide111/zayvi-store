# Hammy owner sign-in flow

Status: server orchestration and encrypted PostgreSQL attempt storage are implemented and tested. No sign-in route, provider resource or selling activation is enabled.

`lib/owner-login.ts` prepares the Cognito authorization-code flow in London with S256 PKCE. Each start generates independent random state, nonce, browser binding and verifier values. Only a hash of state/binding is indexed. The authorization URL contains the challenge, not the verifier. The callback must match the state and browser binding before exchanging a code at the configured provider endpoint. Destinations come from an explicit trusted server context; Hammy’s two pilot paths are configured separately in `lib/hammy-owner-login-context.ts`. Attempts are bound to that context and cannot be completed by another context, even if paths overlap.

The stored attempt expires after ten minutes and is consumed before token exchange. Provider cancellation, exchange failure or verification failure requires a new start; there is no automatic callback retry. Provider diagnostic text and token values are not exposed by errors or returned to the browser.

`lib/owner-login-attempts.ts` stores attempt payloads under AES-256-GCM with a dedicated 32-byte server key. The state and browser hashes are authenticated associated data, preventing ciphertext substitution between attempts. Keys are copied on construction; a key change invalidates in-flight logins rather than exposing an unverified session. This key must be separate from admin-cookie keys and provider credentials, kept in server-only secret storage, and never committed or prefixed NEXT_PUBLIC_.

The repository uses an atomic conditional DELETE through restricted PostgreSQL functions. The database enforces expiry independently of the application's clock, and a mismatched browser cannot delete a valid attempt. Expired rows are cleaned in bounded batches during attempt creation. Use an API-only autocommit query client: consuming the attempt must commit before calling the provider, and must not be rolled back with subsequent session creation.

`database/proposals/owner-login-attempts.sql` is outside the automatic migration package. It creates a private table and a separate non-login, non-superuser, non-BYPASSRLS function-owner role. The ordinary API role cannot read/write the table directly. PUBLIC cannot execute the functions. The proposal does not depend on automatic membership provisioning or create seller accounts.

## Remaining HTTP and provider wiring

- Review the SQL role/grants and promote it into a separate new migration before a saved Preview plan/apply.
- Configure the exact provider domain prefix, app client, callback URI and API scope. Scope settings must match the existing owner-token verifier. No provider is provisioned here.
- Mount the prepared HTTP handler factory with a real durable limiter; see `hammy-owner-sessions.md`. Pin the application origin in server settings rather than deriving it from Host/forwarded headers.
- Set the browser binding in a host-only, HttpOnly, Secure, SameSite=Lax cookie with Path=/ and a ten-minute expiry. Clear it on callback success or failure. Use no-store and no-referrer response headers; exclude authorization codes and token bodies from request logging.
- Connect the prepared token-pair verifier and `createOwnerLoginCompletion` coordinator to a real provider revocation/MFA adapter and a transactional session writer. See `hammy-owner-session-completion.md`. Token verification and membership/store orchestration are tested; persistent session storage is prepared; runtime wiring and live verification remain pending.
- Set a separate secure owner-session cookie from that opaque handle. Never mint the existing shared-password admin cookie. Update workspace guards to validate the owner session and store membership; the current admin paths still use their existing guard.
- Exercise real browser cookies, callback failure/recovery, MFA, revocation and RDS multi-connection behavior before enabling sign-in or catalogue writes.

## Tests

Run `npm run test:store-access`. The owner-login tests cover S256 construction, state/browser matching, duplicate and expired callback parameters, one-use exchange, cancellation, token-response failures and allowed destinations. Embedded PostgreSQL tests verify encrypted payloads, direct-table restrictions, database-clock expiry, ciphertext substitution rejection and callbacks completed through a separate application instance. These are not live Cognito/browser/RDS verification.

References: [Cognito authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html), [PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html), [token endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html).
