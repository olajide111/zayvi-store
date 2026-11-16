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
    `/orders/${encodeURIComponent(id)}/fulfilment-plan`
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
            : "Unable to load fulfilment plan.",
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
  const result = await callZayviAwsApi(
    `/orders/${encodeURIComponent(id)}/fulfilment-plan`,
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
            : "Unable to generate fulfilment plan.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
