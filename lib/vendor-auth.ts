import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const VENDOR_COOKIE = "zayvi_vendor_session";
export const VENDOR_SESSION_MAX_AGE = 8 * 60 * 60;

export type VendorSession = {
  accountId: string;
  supplierId: string;
  role: "owner" | "editor" | "viewer";
  email: string;
  exp: number;
};

function getSigningSecret() {
  const secret = process.env.ZAYVI_UPLOAD_SECRET;
  if (!secret) throw new Error("ZAYVI_UPLOAD_SECRET is not configured.");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSigningSecret())
    .update("vendor:" + payload)
    .digest("base64url");
}

export function createVendorSession(input: {
  accountId: string;
  supplierId: string;
  role: VendorSession["role"];
  email: string;
}) {
  const payload: VendorSession = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + VENDOR_SESSION_MAX_AGE,
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readVendorSession(request: NextRequest): VendorSession | null {
  const value = request.cookies.get(VENDOR_COOKIE)?.value;
  if (!value) return null;

  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const supplied = Buffer.from(signature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as VendorSession;

    if (
      !session.accountId ||
      !session.supplierId ||
      !session.email ||
      !["owner", "editor", "viewer"].includes(session.role) ||
      !Number.isSafeInteger(session.exp) ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
