import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await callZayviAwsApi(
    `/purchase-orders/${encodeURIComponent(id)}/approve`,
    { method: "POST", body: {} }
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
            : "Unable to update purchase order.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
