import { NextRequest, NextResponse } from "next/server";

import { callZayviAwsApi } from "@/lib/aws-api";
import { readVendorSession } from "@/lib/vendor-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = readVendorSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await callZayviAwsApi(
    "/vendor-portal/feed-history?accountId=" +
      encodeURIComponent(session.accountId)
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
            : "Unable to load supplier-feed history.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
