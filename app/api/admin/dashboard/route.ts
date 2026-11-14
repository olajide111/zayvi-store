import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { PRODUCTS } from "@/lib/products";
import { callZayviAwsApi } from "@/lib/aws-api";
import {
  DEFAULT_THEME_CONFIG,
  TEMPLATE_CATALOGUE,
} from "@/lib/storefront-theme";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 }
      );
    }

    const backendResult = await callZayviAwsApi("/ready");
    const backendPayload =
      backendResult.data && typeof backendResult.data === "object"
        ? (backendResult.data as { status?: string; database?: boolean })
        : {};

    return NextResponse.json({
      store: {
        name: "ZAYVI",
        status: "preview",
        purchasingEnabled: false,
      },
      catalogue: {
        totalProducts: PRODUCTS.length,
        categories: [...new Set(PRODUCTS.map((p) => p.category))],
      },
      payments: {
        status: "disabled",
        providers: [
          { name: "PayPal", status: "disabled" },
          { name: "Square", status: "disabled" },
          { name: "Stripe", status: "not_configured" },
        ],
      },
      markets: [
        { code: "GB", name: "United Kingdom", currency: "GBP" },
        { code: "NG", name: "Nigeria", currency: "NGN" },
      ],
      theme: DEFAULT_THEME_CONFIG,
      availableTemplates: TEMPLATE_CATALOGUE,
      backend: {
        status: backendResult.ok ? backendPayload.status || "ready" : "unavailable",
        database: backendPayload.database === true,
        httpStatus: backendResult.status,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load dashboard data." },
      { status: 500 }
    );
  }
}
