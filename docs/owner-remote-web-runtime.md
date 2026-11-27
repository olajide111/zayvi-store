# Assembled remote owner web runtime

Status: composed and tested locally. No route mounting, IAM activation, secret configuration, SQL migration or live sign-in is included.

`createPreviewRemoteOwnerRuntime` joins the prepared components into a single web-side runtime without a private database client:

- encrypted one-use login attempts through the private attempt interface;
- PKCE/state/nonce flow and signed Cognito access/ID token-pair validation;
- current login assurance followed by signed private session completion;
- hash-only private session lookup and logout;
- durable PostgreSQL-backed action limiting using a trusted connection identity;
- current session assurance and a signed, transaction-guarded store read for session status.

The public API returns `handlers` and the named, read-only `readStore` operation. There is deliberately no generic SQL method, caller-selected permission or remote business callback. Other owner dashboard operations need separate named interfaces before they can be mounted. The original direct database runtime is retained for its existing tests; this remote composition is the intended placement across the public-network web service and private RDS boundary.

Activation requires both explicit Preview mode and Preview deployment configuration. Other deployments construct disabled handlers and deny store reads without provider/database adapters. Enabled construction requires current login and session assurance, a trusted connection-identity resolver and the private invocation transport. Four separate 32-byte keys are required for attempt encryption, completion proofs, operation proofs and limiter hashing. Missing, undersized or reused keys are rejected; configuration and keys are copied before component assembly. No secret is sourced from browser data or configured by this change.

The `invoke` dependency accepts only the prepared named request union. It must eventually be implemented with the reviewed, IAM-restricted and pinned private Lambda transport. The test's dispatcher switch is not a deployed entry point. Bound payloads/timeouts, disabled automatic retries, private caller authentication and restricted SQL grants remain activation requirements. Do not expose this interface through the public commerce gateway or Kredal webhook.

## Evidence and remaining work

The integration test uses real RSA-signed token fixtures, all existing SQL proposals and embedded PostgreSQL with the restricted application role. Every private call is dispatched through the corresponding actual service core, including the database limiter. It verifies HTTP start/callback/status/logout, PKCE, one-use callbacks, nonce rejection, committed sessions, current-provider and membership denial, wrong-store rejection, actual exhausted login allowance, missing trusted identity, outage denial and distinct keys. Raw session handles do not cross the recorded private messages.

Provider exchange, JWKS transport, trusted connection identity, private IAM invocation and current MFA/revocation assurance are test adapters. Passing is not evidence of a live provider MFA challenge, actual hosting provenance, IAM enforcement or multi-connection RDS locking.

The next activation work is to implement and verify the actual current Cognito session/MFA assurance strategy, trusted hosting identity and pinned private transport; review/promote the SQL proposals and configure keys and limiter maintenance; provision the exact owner membership; then mount and test the web routes. Enable only after browser/provider/RDS checks pass. No existing admin login or shared store fallback is replaced here, and real payment execution remains disabled in Preview.
