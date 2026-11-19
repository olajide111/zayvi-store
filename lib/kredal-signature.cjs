/* eslint-disable @typescript-eslint/no-require-imports -- Shared CommonJS code for the AWS Lambda archive. */
const crypto = require("node:crypto");

/** @param {string | null | undefined} header */
function parseKredalSignatureHeader(header) {
  if (!header) return null;

  const values = new Map();

  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key && value) values.set(key, value);
  }

  const timestampRaw = values.get("t");
  const signature = values.get("v1");

  if (
    !timestampRaw ||
    !/^\d+$/.test(timestampRaw) ||
    !signature ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return null;
  }

  const timestamp = Number(timestampRaw);

  if (!Number.isSafeInteger(timestamp)) return null;

  return {
    timestamp,
    signature: signature.toLowerCase(),
  };
}

/** @param {{ rawBody: string, signatureHeader: string | null | undefined, secret: string, nowSeconds?: number, toleranceSeconds?: number }} input */
function verifyKredalWebhookSignature(input) {
  if (!input.secret) return false;

  const parsed = parseKredalSignatureHeader(input.signatureHeader);
  if (!parsed) return false;

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;

  if (
    !Number.isSafeInteger(nowSeconds) ||
    !Number.isSafeInteger(toleranceSeconds) ||
    toleranceSeconds < 0 ||
    Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds
  ) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", input.secret)
    .update(String(parsed.timestamp) + "." + input.rawBody, "utf8")
    .digest("hex");

  const actualBuffer = Buffer.from(parsed.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

module.exports = { parseKredalSignatureHeader, verifyKredalWebhookSignature };
