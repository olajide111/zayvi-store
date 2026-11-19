import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

const endpoint = "/storefront-social-links";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return socialLinksResponse(await callZayviAwsApi(endpoint));
}

export async function PUT(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid social profile links." }, { status: 400 });
  }
  return socialLinksResponse(await callZayviAwsApi(endpoint, { method: "PUT", body }));
}

function socialLinksResponse(result: Awaited<ReturnType<typeof callZayviAwsApi>>) {
  const data = result.data as { error?: string; code?: string } | null;
  const pendingSetup = data?.code === "schema_not_ready" || (result.status === 404 && data?.error === "not_found");
  const error = pendingSetup
    ? "Social links need the latest Preview API and database migration 0028. Check System Readiness."
    : result.status === 400 && data?.error
      ? data.error
      : "Social links are temporarily unavailable.";
  return NextResponse.json(result.ok ? result.data : { error }, {
    status: result.ok ? 200 : result.status || 502,
    headers: { "Cache-Control": "no-store" },
  });
}
