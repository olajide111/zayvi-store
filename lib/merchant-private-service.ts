import { createPrivateMerchantRegistrationDispatcher } from "./merchant-registration-rpc";
import { createVerifiedMerchantRegistrationWriter } from "./merchant-registration-completion";
import { createPostgresEncryptedOwnerAttemptStore } from "./owner-login-attempts";
import { createOwnerAttemptDispatcher } from "./owner-attempt-rpc";
import { createPostgresOwnerLimitStore } from "./owner-rate-limit";
import { createOwnerLimitDispatcher } from "./owner-rate-limit-rpc";
import { createMerchantSessionDispatcher } from "./merchant-session-lifecycle-rpc";
import { createPostgresOwnerSessions } from "./owner-sessions";
import { createStoreDatabaseAdapters, type StoreDatabaseClient, type StoreDatabasePool } from "./store-database";
import { createTenantMembershipDirectory } from "./tenant-membership-directory";

/** Direct private Lambda payload only. IAM must authenticate the caller before invocation. */
export function createMerchantPrivateService(
  config: { deployment: string; providerIssuer: string },
  proofKey: Uint8Array,
  dependencies: {
    registrationPool: StoreDatabasePool;
    applicationPool: StoreDatabasePool;
    lookup: Pick<StoreDatabaseClient, "query">;
  },
) {
  const { lookup } = dependencies;
  const database = createStoreDatabaseAdapters(dependencies.applicationPool);
  const directory = createTenantMembershipDirectory({ discovery: lookup, withTenantClient: database.withTenantClient });
  const sessions = createPostgresOwnerSessions({ lookup, withTenantClient: database.withTenantClient });
  const writer = createVerifiedMerchantRegistrationWriter(dependencies.registrationPool, {
    ...database, membershipDirectory: directory, writeSession: sessions.writeSession,
  });
  const register = createPrivateMerchantRegistrationDispatcher(config, proofKey, writer);
  const attempt = createOwnerAttemptDispatcher(createPostgresEncryptedOwnerAttemptStore(lookup));
  const limit = createOwnerLimitDispatcher(createPostgresOwnerLimitStore(lookup));
  const lifecycle = createMerchantSessionDispatcher(config, lookup);

  return async (event: unknown): Promise<unknown> => {
    if (event && typeof event === "object" && "operation" in event) {
      switch (event.operation) {
        case "owner.attempt.create":
        case "owner.attempt.consume":
          return attempt(event);
        case "owner.limit.consume":
          return limit(event);
        case "merchant.registration.complete":
          return register(event);
        case "merchant.session.lookup":
        case "merchant.session.revoke":
          return lifecycle(event);
      }
    }
    throw new Error("Invalid private merchant request.");
  };
}
