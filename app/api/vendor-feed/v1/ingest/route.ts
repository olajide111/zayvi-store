import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const apiKey = match?.[1]?.trim() || "";

  if (!/^zv_vendor_[A-Za-z0-9_-]{4,24}_[A-Za-z0-9_-]{20,80}$/.test(apiKey)) {
    return NextResponse.json(
      { error: "Invalid supplier API credential." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const payload =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};

  const secretHash = createHash("sha256").update(apiKey).digest("hex");

  const result = await callZayviAwsApi("/supplier-api/ingest", {
    method: "POST",
    body: {
      secretHash,
      sourceReference:
        typeof payload.sourceReference === "string"
          ? payload.sourceReference
          : "Supplier API submission",
      items: Array.isArray(payload.items) ? payload.items : [],
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
            : "Supplier feed submission failed.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
