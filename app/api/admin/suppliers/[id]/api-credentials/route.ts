import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";
import { createSupplierApiKey } from "@/lib/supplier-api-key";

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
    "/supplier-api-credentials?supplierId=" + encodeURIComponent(id)
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
            : "Unable to load supplier API credentials.",
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

  let body: { label?: unknown; expiresAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid supplier API credential request." },
      { status: 400 }
    );
  }

  const label = String(body.label || "").trim();
  if (!label) {
    return NextResponse.json(
      { error: "Credential label is required." },
      { status: 400 }
    );
  }

  const {
    apiKey,
    keyPrefix,
    secretHash,
  } = createSupplierApiKey();

  const result = await callZayviAwsApi("/supplier-api-credentials", {
    method: "POST",
    body: {
      supplierId: id,
      label,
      keyPrefix,
      secretHash,
      expiresAt: body.expiresAt ?? null,
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
            : "Unable to create supplier API credential.",
      },
      { status: result.status || 502 }
    );
  }

  const payload =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : {};

  return NextResponse.json(
    {
      ...payload,
      apiKey,
    },
    { status: 201 }
  );
}
