import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { callZayviAwsApi } from "@/lib/aws-api";
import {
  createVendorSession,
  VENDOR_COOKIE,
  VENDOR_SESSION_MAX_AGE,
} from "@/lib/vendor-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { token?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid vendor activation request." }, { status: 400 });
  }

  const token = String(body.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Vendor invitation token is required." }, { status: 400 });
  }

  const inviteTokenHash = createHash("sha256").update(token).digest("hex");

  const result = await callZayviAwsApi("/vendor-portal/activate", {
    method: "POST",
    body: { inviteTokenHash },
  });

  if (!result.ok) {
    const backend =
      result.data && typeof result.data === "object"
        ? (result.data as { error?: unknown }).error
        : undefined;

    return NextResponse.json(
      {
        error:
          typeof backend === "string"
            ? backend
            : "Unable to activate vendor invitation.",
      },
      { status: result.status || 502 }
    );
  }

  const account =
    result.data && typeof result.data === "object"
      ? (result.data as { account?: any }).account
      : null;

  if (!account?.accountId || !account?.supplierId || !account?.role || !account?.email) {
    return NextResponse.json(
      { error: "Vendor activation returned an invalid account." },
      { status: 502 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    supplierName: account.supplierName,
    role: account.role,
  });

  response.cookies.set(
    VENDOR_COOKIE,
    createVendorSession({
      accountId: account.accountId,
      supplierId: account.supplierId,
      role: account.role,
      email: account.email,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: VENDOR_SESSION_MAX_AGE,
      path: "/",
    }
  );

  return response;
}
