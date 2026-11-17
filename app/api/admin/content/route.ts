import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const query = new URLSearchParams();
  query.set("market", request.nextUrl.searchParams.get("market") ?? "GB");
  const slug = request.nextUrl.searchParams.get("slug");
  if (slug !== null) query.set("slug", slug);
  const result = await callZayviAwsApi(`/store-content?${query}`);
  return NextResponse.json(result.data ?? { error: "Content workspace unavailable." }, {
    status: result.status || 502,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Enter a content draft or action." }, { status: 400 });
  }
  const result = await callZayviAwsApi("/store-content", { method: "POST", body });
  return NextResponse.json(result.data ?? { error: "Unable to save content." }, { status: result.status || 502 });
}
