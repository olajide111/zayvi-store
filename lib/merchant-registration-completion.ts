import { createHash, randomBytes } from "node:crypto";
import { createMerchantRegistrationIdentityVerifier, type VerifiedOwnerLogin } from "./owner-identity";
import { OwnerLoginError, type OwnerLoginTokens } from "./owner-login";
import { createVerifiedOwnerSessionWriter, type OwnerLoginCompletionDependencies, type OwnerSessionRecord } from "./owner-login-completion";
import type { StoreDatabasePool } from "./store-database";

type MerchantStoreBinding = { tenantId: string; storeId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RegistrationSessionDependencies = Omit<OwnerLoginCompletionDependencies, "verifyLoginTokens">;

export function validateRegistrationStoreName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 80 || /\p{Cc}/u.test(name)) throw new OwnerLoginError();
  return name;
}

/** Call only with a verified identity from a trusted registration callback or private proof. */
export function createVerifiedMerchantRegistrationWriter(
  registrationPool: StoreDatabasePool,
  sessionDependencies: RegistrationSessionDependencies,
) {
  return async (verified: VerifiedOwnerLogin & { email: string }, storeName: string, record: OwnerSessionRecord) => {
    try {
      const name = validateRegistrationStoreName(storeName);
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

      await createVerifiedOwnerSessionWriter(binding, sessionDependencies)(verified, record);
      return binding;
    } catch {
      throw new OwnerLoginError();
    }
  };
}

export function createMerchantRegistrationCompletion(
  identity: Parameters<typeof createMerchantRegistrationIdentityVerifier>,
  registrationPool: StoreDatabasePool,
  sessionDependencies: RegistrationSessionDependencies,
) {
  const verify = createMerchantRegistrationIdentityVerifier(...identity);
  const write = createVerifiedMerchantRegistrationWriter(registrationPool, sessionDependencies);

  // The caller consumes a registration-specific, one-time OAuth attempt.
  return async (tokens: OwnerLoginTokens, nonce: string, storeName: string) => {
    try {
      const name = validateRegistrationStoreName(storeName);
      const verified = await verify(tokens, nonce);
      const sessionToken = randomBytes(32).toString("base64url");
      const binding = await write(verified, name, {
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
