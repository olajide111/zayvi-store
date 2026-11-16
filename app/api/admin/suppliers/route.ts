import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await callZayviAwsApi("/suppliers");

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Unable to load suppliers from AWS.",
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
    return NextResponse.json({ error: "Invalid supplier request." }, { status: 400 });
  }

  const result = await callZayviAwsApi("/suppliers", {
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
            : "Unable to create supplier.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
