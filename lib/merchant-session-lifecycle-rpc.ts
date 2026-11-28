import { createHash } from "node:crypto";
import { validateStoredOwnerSession, OwnerSessionUnavailable } from "./owner-session-lifecycle-rpc";
import { createPostgresMerchantSessionLifecycle, type StoredOwnerSession } from "./owner-sessions";
import type { StoreDatabaseClient } from "./store-database";

type Config = { deployment: string; providerIssuer: string };
export type MerchantSessionRequest = {
  version: 1;
  operation: "merchant.session.lookup" | "merchant.session.revoke";
  sessionHash: string;
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function validatedIssuer(input: Config) {
  if (input.deployment !== "preview" ||
      !/^https:\/\/cognito-idp\.eu-west-2\.amazonaws\.com\/eu-west-2_[A-Za-z0-9]+$/.test(input.providerIssuer)) {
    throw new OwnerSessionUnavailable();
  }
  return input.providerIssuer;
}

export function createRemoteMerchantSessionLifecycle(input: Config, invoke: (request: MerchantSessionRequest) => Promise<unknown>) {
  const issuer = validatedIssuer(input);
  const valid = (token: unknown): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

  async function call(operation: MerchantSessionRequest["operation"], token: string): Promise<StoredOwnerSession | null> {
    try {
      const sessionHash = createHash("sha256").update(token).digest("hex");
      const reply = await invoke({ version: 1, operation, sessionHash });
      if (!record(reply) || reply.version !== 1 || reply.ok !== true) throw new OwnerSessionUnavailable();
      if (operation === "merchant.session.revoke") {
        if (Object.keys(reply).length !== 2) throw new OwnerSessionUnavailable();
        return null;
      }
      if (Object.keys(reply).length !== 3 || !Object.hasOwn(reply, "session")) throw new OwnerSessionUnavailable();
      if (reply.session === null) return null;
      const session = validateStoredOwnerSession(reply.session);
      if (session.issuer !== issuer || session.role !== "owner") throw new OwnerSessionUnavailable();
      return session;
    } catch {
      throw new OwnerSessionUnavailable();
    }
  }

  return {
    async load(token: string | undefined) { return valid(token) ? call("merchant.session.lookup", token) : null; },
    async revoke(token: string | undefined) { if (valid(token)) await call("merchant.session.revoke", token); },
  };
}

/** Private IAM dispatcher with a registration-bound database adapter. */
export function createMerchantSessionDispatcher(input: Config, lookup: Pick<StoreDatabaseClient, "query">) {
  const issuer = validatedIssuer(input);
  const store = createPostgresMerchantSessionLifecycle(lookup, issuer);
  return async (request: unknown) => {
    try {
      if (!record(request) || Object.keys(request).length !== 3 || request.version !== 1 ||
          (request.operation !== "merchant.session.lookup" && request.operation !== "merchant.session.revoke") ||
          typeof request.sessionHash !== "string" || !/^[a-f0-9]{64}$/.test(request.sessionHash)) {
        throw new OwnerSessionUnavailable();
      }
      if (request.operation === "merchant.session.revoke") {
        await store.revokeHash(request.sessionHash);
        return { version: 1, ok: true };
      }
      const stored = await store.loadHash(request.sessionHash);
      const validated = stored === null ? null : validateStoredOwnerSession(stored);
      const session = validated?.issuer === issuer && validated.role === "owner" ? validated : null;
      return { version: 1, ok: true, session };
    } catch {
      throw new OwnerSessionUnavailable();
    }
  };
}
