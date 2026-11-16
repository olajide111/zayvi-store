import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; allocationId: string }> }
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id, allocationId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid fulfilment execution request." }, { status: 400 });
  }

  const result = await callZayviAwsApi(
    `/orders/${encodeURIComponent(id)}/fulfilment-plan/allocations/${encodeURIComponent(allocationId)}/execution`,
    { method: "POST", body }
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
            : "Unable to update fulfilment execution.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
