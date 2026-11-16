import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";
import {
  createKredalStoreConnection,
  disconnectKredalStore,
  getKredalStoreConnection,
} from "@/lib/kredal-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireTestMode() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Kredal test actions are disabled in production.");
  }

  if (process.env.KREDAL_MODE !== "test") {
    throw new Error("KREDAL_MODE must be set to test.");
  }
}

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await callZayviAwsApi("/payment-connections/kredal");

  if (!result.ok) {
    return NextResponse.json(
      { error: "Unable to load Kredal connection." },
      { status: result.status || 502 }
    );
  }

  const data = result.data as {
    storeId?: string;
    storeName?: string;
    connection?: {
      externalConnectionId?: string;
      status?: "pending" | "active" | "revoked";
      metadata?: Record<string, unknown>;
    } | null;
  };

  if (
    process.env.VERCEL_ENV !== "production" &&
    process.env.KREDAL_MODE === "test" &&
    process.env.KREDAL_PLATFORM_KEY &&
    data.connection?.externalConnectionId
  ) {
    try {
      const provider = await getKredalStoreConnection(
        data.connection.externalConnectionId
      );

      if (
        provider.status &&
        provider.status !== data.connection.status
      ) {
        const synced = await callZayviAwsApi(
          "/payment-connections/kredal",
          {
            method: "PUT",
            body: {
              externalConnectionId: data.connection.externalConnectionId,
              status: provider.status,
              metadata: {
                ...(data.connection.metadata || {}),
                mode: "test",
                lastProviderRefreshAt: new Date().toISOString(),
              },
            },
          }
        );

        if (synced.ok) {
          return NextResponse.json(synced.data, {
            headers: { "cache-control": "no-store" },
          });
        }
      }
    } catch (error) {
      console.warn("Kredal connection refresh failed", error);
    }
  }

  return NextResponse.json(data, {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    requireTestMode();

    const current = await callZayviAwsApi("/payment-connections/kredal");

    if (!current.ok) {
      console.error("Kredal Zayvi connection context failed", {
        status: current.status,
        error: current.error,
        data: current.data,
      });
      throw new Error("Unable to load the Zayvi store connection context.");
    }

    const data = current.data as {
      storeId?: string;
      storeName?: string;
      connection?: {
        externalConnectionId?: string;
        status?: string;
        metadata?: Record<string, unknown>;
      } | null;
    };

    if (
      data.connection?.externalConnectionId &&
      ["pending", "active"].includes(data.connection.status || "")
    ) {
      return NextResponse.json({
        storeId: data.storeId,
        storeName: data.storeName,
        connection: data.connection,
        reused: true,
      });
    }

    if (!data.storeId || !data.storeName) {
      throw new Error("Zayvi main store is not available.");
    }

    const kredal = await createKredalStoreConnection({
      sellerRef: data.storeId,
      sellerName: data.storeName,
    });

    if (!kredal.id || !kredal.approve_url) {
      throw new Error("Kredal did not return an approval URL.");
    }

    const saved = await callZayviAwsApi("/payment-connections/kredal", {
      method: "PUT",
      body: {
        externalConnectionId: kredal.id,
        status: kredal.status || "pending",
        metadata: {
          approveUrl: kredal.approve_url,
          mode: "test",
        },
      },
    });

    if (!saved.ok) {
      throw new Error("Unable to persist the Kredal connection.");
    }

    return NextResponse.json({
      ...(saved.data as object),
      approveUrl: kredal.approve_url,
      reused: false,
    });
  } catch (error) {
    console.error("Kredal test connection failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Kredal test connection.",
      },
      { status: 503 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    requireTestMode();

    const current = await callZayviAwsApi("/payment-connections/kredal");

    if (!current.ok) {
      throw new Error("Unable to load the current Kredal connection.");
    }

    const data = current.data as {
      connection?: {
        externalConnectionId?: string;
      } | null;
    };

    const externalConnectionId = data.connection?.externalConnectionId;

    if (!externalConnectionId) {
      return NextResponse.json({ disconnected: true, existed: false });
    }

    await disconnectKredalStore(externalConnectionId);

    const saved = await callZayviAwsApi("/payment-connections/kredal", {
      method: "PUT",
      body: {
        externalConnectionId,
        status: "revoked",
        metadata: {
          mode: "test",
          disconnectedBy: "zayvi-admin",
        },
      },
    });

    if (!saved.ok) {
      throw new Error("Kredal disconnected but Zayvi could not persist the state.");
    }

    return NextResponse.json({ disconnected: true, existed: true });
  } catch (error) {
    console.error("Kredal test disconnect failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to disconnect Kredal.",
      },
      { status: 503 }
    );
  }
}
