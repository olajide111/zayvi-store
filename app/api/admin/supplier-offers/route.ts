import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supplierId = request.nextUrl.searchParams.get("supplierId") || "";
  if (!supplierId) {
    return NextResponse.json({ error: "Supplier id is required." }, { status: 400 });
  }

  const result = await callZayviAwsApi(
    "/supplier-offers?supplierId=" + encodeURIComponent(supplierId)
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
            : "Unable to load supplier offers.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid supplier offer request." }, { status: 400 });
  }

  const result = await callZayviAwsApi("/supplier-offers", {
    method: "POST",
    body,
  });

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
            : "Unable to save supplier offer.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
