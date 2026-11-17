import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") || "pending_review";
  const result = await callZayviAwsApi(
    "/discovery-candidates?status=" + encodeURIComponent(status)
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
            : "Unable to load discovery candidates.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
