import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "zayvi_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

function getSigningSecret() {
  const secret = process.env.ZAYVI_UPLOAD_SECRET;
  if (!secret) throw new Error("ZAYVI_UPLOAD_SECRET is not configured.");
  return secret;
}

function sign(timestamp: string) {
  return createHmac("sha256", getSigningSecret()).update(timestamp).digest("hex");
}

export function createAdminSession() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return `${timestamp}.${sign(timestamp)}`;
}

export function hasAdminSession(request: NextRequest) {
  const value = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!value) return false;

  const [timestamp, signature] = value.split(".");
  if (!timestamp || !signature || !/^\\d+$/.test(timestamp)) return false;

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (age < 0 || age > SESSION_TTL_SECONDS) return false;

  const expected = Buffer.from(sign(timestamp));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export const ADMIN_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
