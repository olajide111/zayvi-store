import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";
import { parseAnalyticsQuery } from "@/lib/analytics-query.cjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let filters;
  try {
    for (const key of ['range','market']) if (request.nextUrl.searchParams.getAll(key).length > 1) throw new Error();
    filters = parseAnalyticsQuery(Object.fromEntries(request.nextUrl.searchParams));
  } catch {
    return NextResponse.json({error:'Choose a valid analytics period and market.'},{status:400});
  }
  const query = new URLSearchParams(filters);
  const result = await callZayviAwsApi(`/analytics?${query}`);

  if (!result.ok) {
    return NextResponse.json(
      { error: "Unable to load commerce analytics.", backendStatus: result.status },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
