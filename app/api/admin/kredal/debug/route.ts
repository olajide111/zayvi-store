import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await callZayviAwsApi("/payment-connections/kredal");

  return NextResponse.json(
    {
      ok: result.ok,
      status: result.status,
      error: result.error || null,
      data: result.data,
      transport:
        process.env.VERCEL_ENV === "preview" ? "direct-lambda" : "api-gateway",
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    }
  );
}
