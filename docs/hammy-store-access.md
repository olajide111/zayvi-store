# Hammy store access

`lib/store-access.ts` extends the existing verified identity and tenant membership pipeline. It requires a server-owned store UUID; a browser-selected name cannot establish ownership. Missing binding fails closed rather than selecting the legacy `main` store.

The store lookup and protected operation execute inside the existing tenant transaction, after membership revocation and permission checks. Both the returned tenant ID and store ID must match. Draft stores are accessible for setup; suspended and closed stores are denied. A requested store selector can only match the trusted binding.

## Activation dependencies

This is prepared access code, not deployed Hammy ownership or an authentication provider.

1. Configure a signature-, issuer-, audience- and expiry-verifying identity provider adapter. The shared admin-password cookie is not a seller identity and must not be adapted into one.
2. Connect the membership directory to verified issuer/subject records. Recheck membership in the same transaction as the operation.
3. Connect the transaction runner using a non-RLS-bypassing database role and transaction-local `app.tenant_id`.
4. Connect `StoreDirectory.findStore` with a parameterised query matching both `tenant_id` and `id`.
5. Provision/identify Hammy’s independent store and owner membership through a reviewed process. Do not infer ownership from a name, email field, URL or existing platform payment connection.
6. Bind its UUID in private server configuration. Do not accept it from request JSON as the trusted binding.
7. Route every Hammy data operation through this pipeline, with its specific permission. Keep legacy endpoints separate until they are migrated and verified.
8. Verify real database isolation, membership revocation, rollback and concurrent access before enabling catalogue writes or checkout. Current unit tests use injected adapters and do not prove deployed RLS or provider behavior.

No new migration, store record, API wiring, provider configuration, payment execution or customer messaging is activated by this change.
