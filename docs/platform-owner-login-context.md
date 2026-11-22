# Shared platform authentication and pilot contexts

The owner identity, PKCE, membership, session, access and HTTP modules are shared Zayvi platform infrastructure. Hammy is the first pilot that exercises them. This does not make Hammy the default storefront, provision every seller, connect store payments or activate sign-in.

`lib/owner-login-context.ts` requires a server-defined context key, default destination and exact allowlist of destinations. Shared authentication code contains no Hammy landing-page fallback. External URLs, query strings, encoded paths, backslashes and traversal syntax cannot enter the destination policy. Configuration is copied so later mutation cannot silently broaden it.

`lib/hammy-owner-login-context.ts` contains Hammy’s pilot navigation settings. Another store can provide another reviewed context without copying the authentication implementation or changing Store Templates. Navigation contexts are not ownership bindings: the existing verified tenant/store access and database membership checks remain mandatory.

Each encrypted login attempt now includes its originating context key. Completion rejects a missing or different key before exchanging the code, even where two contexts share the same return path. An older in-flight attempt without a context requires a fresh sign-in. No schema change is needed because the context is part of the authenticated encrypted payload.

The HTTP handler independently enforces its configured destination allowlist before setting an owner cookie. Supply the same trusted context to the login flow and HTTP handler. Do not derive keys, allowlists or provider settings from a browser-submitted store name, tenant ID or return URL. A future store selector must resolve only verified memberships and select a trusted server context.

Store data remains isolated by server-bound tenant/store IDs, membership and permissions; this context feature adds login-intent isolation, not an alternative authorisation mechanism. Hammy branding, department choices and Store Templates remain independent. All previously documented provider, SQL, private runtime and browser verification requirements still apply before activation.

Validation: tests cover another store’s configured destination without a Hammy fallback, cross-context callback rejection, missing context, immutable configuration and independent HTTP destination rejection. The existing signed-token, session and embedded PostgreSQL checks remain in the access suite. The token test’s expected authentication timestamp is captured from the issued payload, removing a second-boundary assertion race without changing verification policy.
