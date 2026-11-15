import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function parseSignatureHeader(header: string) {
  const fields = new Map<string, string>();

  for (const part of header.split(",")) {
    const [key, ...rest] = part.trim().split("=");
    if (key && rest.length) {
      fields.set(key, rest.join("="));
    }
  }

  return {
    timestamp: fields.get("t"),
    signature: fields.get("v1"),
  };
}

export function verifyKredalWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  nowSeconds?: number;
  toleranceSeconds?: number;
}) {
  const secret = process.env.KREDAL_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Kredal webhook verification is not configured.");
  }

  if (!input.signatureHeader) {
    return false;
  }

  const { timestamp, signature } = parseSignatureHeader(input.signatureHeader);
  if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[a-f0-9]+$/i.test(signature)) {
    return false;
  }

  const eventTime = Number(timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;

  if (!Number.isSafeInteger(eventTime) || Math.abs(now - eventTime) > tolerance) {
    return false;
  }

  const signedPayload = timestamp + "." + input.rawBody;
  const expected = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const suppliedBuffer = Buffer.from(signature.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(suppliedBuffer, expectedBuffer);
}
