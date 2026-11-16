import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await callZayviAwsApi("/payment-events/kredal");

  if (!result.ok) {
    console.error("Direct Lambda Kredal events GET failed", {
      status: result.status,
      error: result.error,
      data: result.data,
    });
    return NextResponse.json(
      { error: "Unable to load Kredal events." },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data, {
    headers: { "cache-control": "no-store" },
  });
}
