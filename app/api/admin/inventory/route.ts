import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const market = (request.nextUrl.searchParams.get("market") || "GB").toUpperCase();

  if (!["GB", "NG"].includes(market)) {
    return NextResponse.json({ error: "Unsupported inventory market." }, { status: 400 });
  }

  const result = await callZayviAwsApi(
    "/inventory?market=" + encodeURIComponent(market)
  );

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


export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid inventory adjustment." }, { status: 400 });
  }

  const result = await callZayviAwsApi("/inventory/adjust", {
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
            : "Unable to adjust inventory.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
