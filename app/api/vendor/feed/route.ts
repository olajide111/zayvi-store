import { NextRequest, NextResponse } from "next/server";

import { callZayviAwsApi } from "@/lib/aws-api";
import { readVendorSession } from "@/lib/vendor-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = readVendorSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (session.role === "viewer") {
    return NextResponse.json(
      { error: "Viewer accounts cannot submit supplier feeds." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid supplier-feed request." },
      { status: 400 }
    );
  }

  const result = await callZayviAwsApi("/vendor-portal/feed", {
    method: "POST",
    body: {
      ...(body && typeof body === "object" ? body : {}),
      accountId: session.accountId,
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
            : "Unable to submit supplier feed.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
