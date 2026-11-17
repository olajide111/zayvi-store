import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; credentialId: string }> }
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { credentialId } = await context.params;

  const result = await callZayviAwsApi(
    `/supplier-api-credentials/${encodeURIComponent(credentialId)}/revoke`,
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
            : "Unable to revoke supplier API credential.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
