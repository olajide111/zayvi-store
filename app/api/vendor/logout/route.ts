import { NextRequest, NextResponse } from "next/server";

import { VENDOR_COOKIE } from "@/lib/vendor-auth";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(VENDOR_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
