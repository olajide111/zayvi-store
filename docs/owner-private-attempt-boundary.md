# Private login-attempt boundary

The operator's 22 November 2026 apply created the four Preview Cognito resources (pool `eu-west-2_VA9Jt43V4`, client `2rum6s096vv9b3nab5guuodfvs`). The read-only preflight reported all 15 checks passed. These are operator-supplied deployment results, not live observations from this checkout. Owner runtime activation remains disabled.

## Prepared implementation

`lib/owner-attempt-rpc.ts` defines two versioned operations: create an encrypted login attempt and atomically consume it using its state and browser hashes. The web-side adapter encrypts/decrypts with the dedicated key; the database-side adapter executes only the two fixed, parameterised stored-function calls. The RPC body contains no plaintext PKCE verifier, nonce, destination, provider token, role, tenant selector or SQL.

Requests and replies reject unknown fields, unsupported versions, malformed hashes and plaintext payloads. Errors returned to the caller are generic. Neither adapter retries a consumed attempt after a lost reply: the buyer/owner starts sign-in again. Database constraints and database time remain authoritative for expiry. This boundary is shared platform infrastructure, independent of Hammy's branding.

This commit does not mount a Lambda entry point or HTTP route, add IAM grants, apply SQL, enable authentication or open database networking. The dispatcher core is not an authentication mechanism. Before deployment, its entry point must restrict invocation to the reviewed server role and Preview environment; browser calls and public gateway routes must never reach it. Do not wrap it in the public payment-webhook route or a generic SQL RPC.

## Runtime placement and remaining work

Keep OAuth exchange and JWKS retrieval on the public-network server runtime. Keep PostgreSQL and its restricted application role in the existing private network. The final invocation adapter needs a pinned function name/account/region, IAM-authenticated direct invocation, bounded payload/response sizes and timeouts, and no automatic consume retry. No new NAT gateway or public RDS access is required by this design.

The same typed-boundary approach still needs to cover session completion, membership resolution, protected operations and revocation without splitting the existing tenant transaction. A generic remote `query()` implementation is not acceptable. Current-session provider assurance, durable rate limiting, reviewed migrations, exact owner membership, mounted routes and live browser/RDS tests remain activation gates.

## Verification

The store-access suite includes an embedded PostgreSQL round trip through both RPC adapters using the real proposal SQL and restricted role. It verifies ciphertext-only messages, wrong-browser rejection, one successful consume from competing calls, database expiry constraints, restricted table access, malformed requests/replies and no retry after a lost reply. This is local integration verification; it does not prove live IAM invocation, network reachability or real RDS multi-connection locking.
