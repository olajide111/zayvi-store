import { createHash, randomBytes } from "node:crypto";
import { createMerchantRegistrationIdentityVerifier } from "./owner-identity";
import { OwnerLoginError, type OwnerLoginTokens } from "./owner-login";
import { createVerifiedOwnerSessionWriter, type OwnerLoginCompletionDependencies } from "./owner-login-completion";
import type { StoreDatabasePool } from "./store-database";

type MerchantStoreBinding = { tenantId: string; storeId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createMerchantRegistrationCompletion(
  identity: Parameters<typeof createMerchantRegistrationIdentityVerifier>,
  registrationPool: StoreDatabasePool,
  sessionDependencies: Omit<OwnerLoginCompletionDependencies, "verifyLoginTokens">,
) {
  const verify = createMerchantRegistrationIdentityVerifier(...identity);

  // The caller must consume a registration-specific, one-time OAuth attempt before
  // providing tokens, nonce and store name. This function is a private callback step.
  return async (tokens: OwnerLoginTokens, nonce: string, storeName: string) => {
    try {
      const name = storeName.trim();
      if (!name || name.length > 80 || /\p{Cc}/u.test(name)) throw new OwnerLoginError();
      const verified = await verify(tokens, nonce);
      const registration = await registrationPool.connect();
      let binding: MerchantStoreBinding;
      try {
        const { rows } = await registration.query(
          "SELECT tenant_id, store_id FROM zayvi_registration.create_draft_store($1,$2,$3,$4)",
          [verified.identity.issuer, verified.identity.subject, verified.email, name],
        );
        const row = rows[0];
        if (rows.length !== 1 || typeof row.tenant_id !== "string" || !uuid.test(row.tenant_id) ||
          typeof row.store_id !== "string" || !uuid.test(row.store_id)) throw new OwnerLoginError();
        binding = { tenantId: row.tenant_id, storeId: row.store_id };
      } finally {
        registration.release();
      }

      const write = createVerifiedOwnerSessionWriter(binding, sessionDependencies);
      const sessionToken = randomBytes(32).toString("base64url");
      await write(verified, {
        sessionHash: createHash("sha256").update(sessionToken).digest("hex"),
        providerSessionId: verified.providerSession.sessionId,
        providerTokenId: verified.providerSession.tokenId,
        expiresAt: verified.expiresAt,
      });
      return { ...binding, sessionToken };
    } catch {
      throw new OwnerLoginError();
    }
  };
}
