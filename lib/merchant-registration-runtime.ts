import { timingSafeEqual } from "node:crypto";
import type { JWTVerifyGetKey } from "jose";
import { createRemoteMerchantRegistrationCompletion, type MerchantRegistrationRequest } from "./merchant-registration-rpc";
import { createMerchantRegistrationHandlers, type OwnerAuthHttpDependencies } from "./owner-auth-http";
import type { OwnerRuntimeConfig } from "./owner-auth-runtime";
import { createMerchantRegistrationIdentityVerifier } from "./owner-identity";
import { createEncryptedOwnerLoginAttempts } from "./owner-login-attempts";
import { createRemoteOwnerAttemptStore, type OwnerAttemptRequest } from "./owner-attempt-rpc";
import { createMerchantRegistrationFlow } from "./owner-login";
import { createOwnerAuthLimiter } from "./owner-rate-limit";
import { createRemoteOwnerLimitStore, type OwnerLimitRequest } from "./owner-rate-limit-rpc";

type PrivateRequest = MerchantRegistrationRequest | OwnerAttemptRequest | OwnerLimitRequest;
type Dependencies = Pick<OwnerAuthHttpDependencies, "sessions" | "authorise"> & {
  keys: { attemptEncryption: Uint8Array; registrationProof: Uint8Array; limiterHash: Uint8Array };
  invoke(message: PrivateRequest): Promise<unknown>;
  identifyConnection(request: Request): Promise<string | null>;
  verifyLoginAssurance: Parameters<typeof createMerchantRegistrationIdentityVerifier>[1];
  identityKeys?: JWTVerifyGetKey;
  providerExchange?: typeof fetch;
};

/** Compose signup on the web host without a database client. The caller must supply
 * private session lookup that resolves the new store by its session, not a pilot binding.
 */
export function createPreviewMerchantRegistrationRuntime(input: Omit<OwnerRuntimeConfig, "binding">, dependencies?: Dependencies) {
  const context = { ...input.context, allowedPaths: [...input.context.allowedPaths] };
  const { origin } = input;
  if (input.mode !== "preview" || input.deployment !== "preview") {
    return createMerchantRegistrationHandlers({ origin, context, enabled: false });
  }
  if (!dependencies || typeof dependencies.invoke !== "function" ||
      typeof dependencies.identifyConnection !== "function" || typeof dependencies.sessions?.load !== "function") {
    throw new Error("Complete Preview merchant registration adapters are required.");
  }
  const { attemptEncryption, registrationProof, limiterHash } = dependencies.keys;
  const values = [attemptEncryption, registrationProof, limiterHash];
  if (values.some(value => !(value instanceof Uint8Array) || value.byteLength !== 32)) {
    throw new Error("Three dedicated merchant registration keys are required.");
  }
  if (timingSafeEqual(attemptEncryption, registrationProof) || timingSafeEqual(attemptEncryption, limiterHash) ||
      timingSafeEqual(registrationProof, limiterHash)) throw new Error("Merchant registration runtime keys must be distinct.");

  const { invoke } = dependencies;
  const attempts = createEncryptedOwnerLoginAttempts(createRemoteOwnerAttemptStore(invoke), attemptEncryption);
  const verify = createMerchantRegistrationIdentityVerifier(input.provider, dependencies.verifyLoginAssurance, dependencies.identityKeys);
  const providerIssuer = "https://cognito-idp.eu-west-2.amazonaws.com/" + input.provider.userPoolId;
  const finishVerifiedRegistration = createRemoteMerchantRegistrationCompletion(
    { deployment: input.deployment, providerIssuer }, registrationProof, { verify, invoke },
  );
  const flow = createMerchantRegistrationFlow({
    appOrigin: origin, context, domainPrefix: input.domainPrefix, clientId: input.provider.clientId,
    scopes: [...new Set(["openid", "email", ...input.provider.requiredScopes, ...(input.additionalScopes ?? [])])],
  }, { attempts, fetcher: dependencies.providerExchange, finishVerifiedRegistration });
  const limit = createOwnerAuthLimiter({
    key: limiterHash, identify: dependencies.identifyConnection, store: createRemoteOwnerLimitStore(invoke),
  });
  return createMerchantRegistrationHandlers({ origin, context, enabled: true }, { ...dependencies, flow, limit });
}
