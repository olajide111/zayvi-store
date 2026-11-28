import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { createMerchantRegistrationIdentityVerifier, VerifiedOwnerLogin } from "./owner-identity";
import { createVerifiedMerchantRegistrationWriter, validateRegistrationStoreName } from "./merchant-registration-completion";
import { OwnerLoginError, type OwnerLoginTokens } from "./owner-login";
import { assertVerifiedOwnerLogin } from "./owner-session-completion-rpc";

type Config = { deployment: string; providerIssuer: string };
export type MerchantRegistrationRequest = { version: 1; operation: "merchant.registration.complete"; proof: string };
type Writer = ReturnType<typeof createVerifiedMerchantRegistrationWriter>;
const issuer = "urn:zayvi:preview:merchant-registration-web";
const audience = "urn:zayvi:preview:merchant-registration-db";
const typ = "zayvi-merchant-registration+jwt";
const operation = "merchant.registration.complete";
const emailPattern = /^[^\s@]+@[^\s@]+$/;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

function settings(config: Config, secret: Uint8Array) {
  if (config.deployment !== "preview" ||
      !/^https:\/\/cognito-idp\.eu-west-2\.amazonaws\.com\/eu-west-2_[A-Za-z0-9]+$/.test(config.providerIssuer) ||
      secret.byteLength !== 32) throw new Error("Preview merchant registration requires a pinned provider and a dedicated proof key.");
  return { providerIssuer: config.providerIssuer, key: Buffer.from(secret) };
}

export function createRemoteMerchantRegistrationCompletion(config: Config, secret: Uint8Array, dependencies: {
  verify: ReturnType<typeof createMerchantRegistrationIdentityVerifier>;
  /** Private, pinned IAM transport. Do not retry completion automatically. */
  invoke(request: MerchantRegistrationRequest): Promise<unknown>;
}) {
  const { providerIssuer, key } = settings(config, secret);
  return async (tokens: OwnerLoginTokens, nonce: string, storeName: string) => {
    try {
      const name = validateRegistrationStoreName(storeName);
      const login = await dependencies.verify(tokens, nonce);
      assertVerifiedOwnerLogin(login, providerIssuer);
      if (login.email.length > 254 || !emailPattern.test(login.email)) throw new OwnerLoginError();

      const sessionToken = randomBytes(32).toString("base64url");
      const sessionHash = createHash("sha256").update(sessionToken).digest("hex");
      const now = Math.floor(Date.now() / 1000);
      const proof = await new SignJWT({
        provider_issuer: providerIssuer,
        auth_time: login.identity.authenticationTime,
        provider_session: login.providerSession.sessionId,
        provider_token: login.providerSession.tokenId,
        session_exp: login.expiresAt,
        email: login.email,
        store_name: name,
      }).setProtectedHeader({ alg: "HS256", typ }).setIssuer(issuer).setAudience(audience)
        .setSubject(login.identity.subject).setJti(sessionHash).setIssuedAt(now)
        .setExpirationTime(Math.min(now + 30, login.expiresAt)).sign(key);

      const reply = await dependencies.invoke({ version: 1, operation, proof });
      if (!record(reply) || !exact(reply, ["version", "ok", "expiresAt"]) ||
          reply.version !== 1 || reply.ok !== true || reply.expiresAt !== login.expiresAt) throw new OwnerLoginError();
      return { sessionToken };
    } catch {
      throw new OwnerLoginError();
    }
  };
}

export function createPrivateMerchantRegistrationDispatcher(config: Config, secret: Uint8Array, write: Writer) {
  const { providerIssuer, key } = settings(config, secret);
  return async (request: unknown) => {
    try {
      if (!record(request) || !exact(request, ["version", "operation", "proof"]) ||
          request.version !== 1 || request.operation !== operation || typeof request.proof !== "string" ||
          request.proof.length > 8192) throw new OwnerLoginError();
      const claims = ["iss", "aud", "sub", "iat", "exp", "jti", "provider_issuer", "auth_time",
        "provider_session", "provider_token", "session_exp", "email", "store_name"];
      const { payload } = await jwtVerify(request.proof, key, {
        issuer, audience, typ, algorithms: ["HS256"], maxTokenAge: 30, requiredClaims: claims,
      });
      const now = Math.floor(Date.now() / 1000);
      if (!exact(payload, claims) || payload.aud !== audience || payload.provider_issuer !== providerIssuer ||
          typeof payload.sub !== "string" || typeof payload.jti !== "string" || !/^[a-f0-9]{64}$/.test(payload.jti) ||
          typeof payload.iat !== "number" || !Number.isSafeInteger(payload.iat) || payload.iat > now ||
          typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp) ||
          payload.exp <= payload.iat || payload.exp - payload.iat > 30 ||
          typeof payload.auth_time !== "number" || typeof payload.session_exp !== "number" || payload.exp > payload.session_exp ||
          typeof payload.provider_session !== "string" || typeof payload.provider_token !== "string" ||
          typeof payload.email !== "string" || payload.email.length > 254 || !emailPattern.test(payload.email)) throw new OwnerLoginError();

      const name = validateRegistrationStoreName(payload.store_name);
      const identity = { issuer: providerIssuer, subject: payload.sub, authenticationTime: payload.auth_time, mfaVerified: true as const };
      const login: VerifiedOwnerLogin = {
        identity,
        providerSession: { ...identity, sessionId: payload.provider_session, tokenId: payload.provider_token },
        expiresAt: payload.session_exp,
      };
      assertVerifiedOwnerLogin(login, providerIssuer);
      await write({ ...login, email: payload.email }, name, {
        sessionHash: payload.jti,
        providerSessionId: login.providerSession.sessionId,
        providerTokenId: login.providerSession.tokenId,
        expiresAt: login.expiresAt,
      });
      return { version: 1, ok: true, expiresAt: login.expiresAt };
    } catch {
      throw new OwnerLoginError();
    }
  };
}
