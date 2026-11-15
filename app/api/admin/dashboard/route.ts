import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
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

    const [backendResult, catalogueResult, marketsResult] = await Promise.all([
      callZayviAwsApi("/ready"),
      callZayviAwsApi("/products"),
      callZayviAwsApi("/markets"),
    ]);

    const backendPayload =
      backendResult.data && typeof backendResult.data === "object"
        ? (backendResult.data as { status?: string; database?: boolean })
        : {};

    const cataloguePayload =
      catalogueResult.data && typeof catalogueResult.data === "object"
        ? (catalogueResult.data as {
            total?: number;
            products?: Array<{ category?: string }>;
          })
        : {};

    const catalogueProducts = Array.isArray(cataloguePayload.products)
      ? cataloguePayload.products
      : [];

    const marketPayload =
      marketsResult.data && typeof marketsResult.data === "object"
        ? (marketsResult.data as {
            markets?: Array<{ code: string; name: string; currency: string }>;
          })
        : {};

    const markets = Array.isArray(marketPayload.markets)
      ? marketPayload.markets
      : [];

    return NextResponse.json({
      store: {
        name: "ZAYVI",
        status: "preview",
        purchasingEnabled: false,
      },
      catalogue: {
        totalProducts: cataloguePayload.total ?? catalogueProducts.length,
        categories: [
          ...new Set(
            catalogueProducts
              .map((product) => product.category)
              .filter((category): category is string => Boolean(category))
          ),
        ],
      },
      payments: {
        status: "disabled",
        providers: [
          { name: "PayPal", status: "disabled" },
          { name: "Square", status: "disabled" },
          { name: "Stripe", status: "not_configured" },
        ],
      },
      markets,
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
