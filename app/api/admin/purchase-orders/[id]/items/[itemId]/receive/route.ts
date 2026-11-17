import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id, itemId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid receipt request." }, { status: 400 });
  }

  const result = await callZayviAwsApi(
    `/purchase-orders/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/receive`,
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
            : "Unable to receive purchase-order stock.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
