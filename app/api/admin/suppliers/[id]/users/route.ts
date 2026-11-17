import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await callZayviAwsApi(
    "/supplier-users?supplierId=" + encodeURIComponent(id)
  );

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
            : "Unable to load vendor portal users.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: {
    email?: unknown;
    displayName?: unknown;
    role?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid vendor invitation request." }, { status: 400 });
  }

  const token = randomBytes(32).toString("base64url");
  const inviteTokenHash = createHash("sha256").update(token).digest("hex");
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const result = await callZayviAwsApi("/supplier-users/invite", {
    method: "POST",
    body: {
      supplierId: id,
      email: body.email,
      displayName: body.displayName,
      role: body.role,
      inviteTokenHash,
      inviteExpiresAt,
    },
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
            : "Unable to create vendor invitation.",
      },
      { status: result.status || 502 }
    );
  }

  const inviteUrl = new URL("/vendor/activate", request.nextUrl.origin);
  inviteUrl.searchParams.set("token", token);

  const payload =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : {};

  return NextResponse.json(
    {
      ...payload,
      inviteUrl: inviteUrl.toString(),
      inviteExpiresAt,
    },
    { status: 201 }
  );
}
