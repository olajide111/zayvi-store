import { createHash, randomBytes } from "node:crypto";

const API_KEY_PATTERN =
  /^zv_vendor_[A-Za-z0-9_-]{4,24}_[A-Za-z0-9_-]{20,80}$/;

export function createSupplierApiKey() {
  const keyPrefix = "zv_vendor_" + randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const apiKey = keyPrefix + "_" + secret;

  return {
    apiKey,
    keyPrefix,
    secretHash: hashSupplierApiKey(apiKey),
  };
}

export function isSupplierApiKey(value: string) {
  return API_KEY_PATTERN.test(value);
}

export function hashSupplierApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
