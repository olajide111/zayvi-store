import { NextRequest, NextResponse } from "next/server";

import { callZayviAwsApi } from "@/lib/aws-api";
import { readVendorSession } from "@/lib/vendor-auth";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ offerId: string }> }
) {
  const session = readVendorSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (session.role === "viewer") {
    return NextResponse.json(
      { error: "Viewer accounts cannot update supplier offers." },
      { status: 403 }
    );
  }

  const { offerId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid supplier offer update." }, { status: 400 });
  }

  const result = await callZayviAwsApi(
    `/vendor-portal/offers/${encodeURIComponent(offerId)}`,
    {
      method: "PATCH",
      body: {
        ...(body && typeof body === "object" ? body : {}),
        accountId: session.accountId,
      },
    }
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
            : "Unable to update supplier offer.",
      },
      { status: result.status || 502 }
    );
  }

  return NextResponse.json(result.data);
}
