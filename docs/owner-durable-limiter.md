# Owner sign-in rate limiting

Status: implemented with embedded PostgreSQL tests; unmounted and not activated. This change creates no AWS resources, secrets, routes or automatic migrations.

`createOwnerAuthLimiter` implements the existing owner HTTP handler's `limit` dependency. A deployment-specific, stable 32-byte HMAC key pseudonymises a trusted connection identity before persistence or private RPC. The injected identity resolver must derive identity from authenticated hosting metadata. It must never trust a browser's forwarding headers, cookies or query parameters. No hosting resolver or key is configured by this change. An absent identity or failed storage raises a generic unavailable error; the existing HTTP gate returns 503, while exhausted allowances return 429.

The PostgreSQL function uses database time and atomic upserts. Admission must run on an independent autocommit database path and commit before sign-in work; do not place it inside a business transaction that could later roll back its counters. Every action consumes a global admission row before its subject row; global denial does not create another subject. This bounds new-key admission. The caller cannot supply a budget, clock, window or SQL statement. Budgets are fixed one-minute windows:

| Action | Per connection identity | Deployment-wide |
| --- | ---: | ---: |
| Start | 10 | 1,000 |
| Callback | 20 | 2,000 |
| Status | 120 | 12,000 |
| Logout | 20 | 2,000 |

Fixed windows can admit two windows' allowances across a minute boundary. These are initial defensive limits, not load-tested production capacity. Shared connection identities share their allowance. Current identity verification and store authorisation are still required; a limiter never grants access.

The proposal depends on the login-attempt proposal's private schema. The application role can execute only `consume_limit`, without direct table access or purge privileges. The function owner is a separate non-login role. A separate bounded maintenance function removes at most 1,000 expired subject rows per call using skipped locked rows; it retains global rows. Activation must assign a restricted maintenance caller and schedule sufficient cleanup. No job or privilege grant is activated here.

The private typed RPC sends only version, named action and HMAC hash. Its dispatcher is a service core, not caller authentication. Any eventual Lambda entry must pin Preview deployment, account, region and function, restrict IAM invocation to the reviewed web role, bound payloads/timeouts and disable automatic retries. A lost reply may consume an allowance; it must not permit the sign-in anyway. Do not expose it through the public commerce gateway or Kredal webhook.

Before activation: review/promote the SQL proposal, provision the dedicated private key, verify trusted hosting identity, connect the private IAM transport, schedule cleanup and test real RDS concurrency, timeouts, throttling and provider failure. Existing Cognito current-session/MFA assurance and remote session lifecycle still need implementation. Owner sign-in remains disabled.

Tests prove shared local persistence across two adapters, per-action budgets, expiry reset, global new-key suppression, table/function privileges, bounded purge, malformed input/reply rejection, generic failure and no automatic retry. Embedded PostgreSQL serialises its connection; this is not evidence of multi-connection RDS locking or live hosting identity provenance.
