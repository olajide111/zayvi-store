import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const result = await callZayviAwsApi("/storefront-market-settings");
  return marketResponse(result);
}

export async function PATCH(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid market settings." }, { status: 400 });
  }

  const result = await callZayviAwsApi("/storefront-market-settings", { method: "PATCH", body });
  return marketResponse(result);
}

function marketResponse(result: Awaited<ReturnType<typeof callZayviAwsApi>>) {
  const error = result.data as { error?: string } | null;
  return NextResponse.json(
    result.ok ? result.data : {
      error: result.status === 400 ? error?.error || "Invalid market settings." : "Storefront market settings are unavailable.",
    },
    { status: result.ok ? 200 : result.status || 502, headers: { "Cache-Control": "no-store" } }
  );
}
