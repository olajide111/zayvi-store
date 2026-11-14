import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await callZayviAwsApi("/inventory");

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Unable to load inventory from AWS.",
        backendStatus: result.status,
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
