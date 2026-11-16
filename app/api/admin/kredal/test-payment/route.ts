import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";
import {
  cancelKredalPayment,
  createKredalPayment,
  getKredalPayment,
} from "@/lib/kredal-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireTestMode() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Kredal test payments are disabled in production.");
  }

  if (process.env.KREDAL_MODE !== "test") {
    throw new Error("KREDAL_MODE must be set to test.");
  }
}

function toMinorUnits(amount: number) {
  const scaled = amount * 100;
  const rounded = Math.round(scaled);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(rounded) ||
    Math.abs(scaled - rounded) > 0.000001
  ) {
    throw new Error("Order amount cannot be represented safely in kobo.");
  }

  return rounded;
}

async function loadOrder(orderId: string) {
  const result = await callZayviAwsApi(
    "/orders/" + encodeURIComponent(orderId)
  );

  if (!result.ok) {
    throw new Error("Unable to load the Zayvi order.");
  }

  const payload = result.data as {
    order?: {
      id?: string;
      orderNumber?: string;
      customerEmail?: string;
      marketCode?: string;
      currency?: string;
      total?: number;
      paymentStatus?: string;
      orderStatus?: string;
    };
  };

  if (!payload.order?.id || !payload.order.orderNumber) {
    throw new Error("Zayvi order details are incomplete.");
  }

  return {
    id: payload.order.id,
    orderNumber: payload.order.orderNumber,
    customerEmail: payload.order.customerEmail,
    marketCode: payload.order.marketCode || "",
    currency: payload.order.currency || "",
    total: Number(payload.order.total),
    paymentStatus: payload.order.paymentStatus || "",
    orderStatus: payload.order.orderStatus || "",
  };
}

async function loadConnection() {
  const result = await callZayviAwsApi("/payment-connections/kredal");

  if (!result.ok) {
    throw new Error("Unable to load the Kredal store connection.");
  }

  const payload = result.data as {
    connection?: {
      externalConnectionId?: string;
      status?: string;
    } | null;
  };

  if (
    payload.connection?.status !== "active" ||
    !payload.connection.externalConnectionId
  ) {
    throw new Error("The Zayvi store does not have an active Kredal connection.");
  }

  return payload.connection.externalConnectionId;
}

async function loadAttempt(orderId: string) {
  const result = await callZayviAwsApi(
    "/payment-attempts/kredal?orderId=" +
      encodeURIComponent(orderId)
  );

  if (!result.ok) {
    throw new Error("Unable to load the Kredal payment attempt.");
  }

  const payload = result.data as {
    attempt?: {
      providerReference?: string;
      connectionId?: string;
      status?: string;
      amount?: number;
      currency?: string;
      orderNumber?: string;
    } | null;
  };

  if (!payload.attempt?.providerReference) {
    throw new Error("No Kredal payment attempt exists for this order.");
  }

  return {
    providerReference: payload.attempt.providerReference,
    connectionId: payload.attempt.connectionId,
    status: payload.attempt.status || "",
    amount: Number(payload.attempt.amount),
    currency: payload.attempt.currency || "",
    orderNumber: payload.attempt.orderNumber || "",
  };
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    requireTestMode();

    const body = await request.json();
    const orderId =
      typeof body?.orderId === "string" ? body.orderId.trim() : "";

    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json(
        { error: "A valid Zayvi order id is required." },
        { status: 400 }
      );
    }

    const order = await loadOrder(orderId);

    if (
      order.marketCode !== "NG" ||
      order.currency !== "NGN" ||
      !["unpaid", "pending"].includes(order.paymentStatus || "")
    ) {
      return NextResponse.json(
        { error: "Kredal test checkout requires an unpaid NGN order." },
        { status: 409 }
      );
    }

    const connectionId = await loadConnection();
    const amountMinor = toMinorUnits(Number(order.total));
    const idempotencyKey =
      "kredal-test-" +
      createHash("sha256")
        .update(order.id + ":" + order.orderNumber)
        .digest("hex")
        .slice(0, 48);

    const payment = await createKredalPayment({
      connectionId,
      amountMinor,
      reference: order.orderNumber,
      idempotencyKey,
      description: "ZAYVI test order " + order.orderNumber,
      customerEmail: order.customerEmail,
      callbackUrl:
        (process.env.NEXT_PUBLIC_STORE_URL || request.nextUrl.origin) +
        "/admin/payments?kredal_return=1&order_id=" +
        encodeURIComponent(order.id),
      metadata: {
        zayvi_order_id: order.id,
        mode: "test",
      },
      expiresInHours: 2,
    });

    const providerReference =
      (typeof payment.id === "string" && payment.id) ||
      (typeof payment.reference === "string" && payment.reference) ||
      order.orderNumber;

    const persisted = await callZayviAwsApi(
      "/payment-attempts/kredal",
      {
        method: "POST",
        body: {
          orderId: order.id,
          idempotencyKey,
          providerReference,
          providerPayload: {
            ...payment,
            mode: "test",
          },
        },
      }
    );

    if (!persisted.ok) {
      throw new Error("Kredal payment was created but Zayvi could not persist it.");
    }

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountMinor,
      currency: "NGN",
      checkoutUrl: payment.checkout_url || null,
      providerReference,
      attempt: (persisted.data as { attempt?: unknown }).attempt || null,
      testMode: true,
    });
  } catch (error) {
    console.error("Kredal test payment create failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Kredal test payment.",
      },
      { status: 503 }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    requireTestMode();

    const body = await request.json();
    const orderId =
      typeof body?.orderId === "string" ? body.orderId.trim() : "";

    const attempt = await loadAttempt(orderId);
    const connectionId =
      attempt.connectionId || (await loadConnection());

    const payment = await getKredalPayment(
      connectionId,
      attempt.providerReference
    );

    const providerPaymentState =
      typeof payment.payment_state === "string"
        ? payment.payment_state.trim().toLowerCase()
        : "";
    const providerHoldState =
      typeof payment.hold_state === "string"
        ? payment.hold_state.trim().toLowerCase()
        : null;

    const supported = new Set([
      "created",
      "pending",
      "succeeded",
      "failed",
      "cancelled",
      "expired",
      "partially_refunded",
      "refunded",
    ]);

    if (!supported.has(providerPaymentState)) {
      return NextResponse.json({
        verified: true,
        applied: false,
        providerPaymentState: providerPaymentState || "unknown",
        providerHoldState,
        payment,
        message:
          "Kredal returned a status Zayvi does not map yet; no order state was changed.",
      });
    }

    const applied = await callZayviAwsApi(
      "/payment-attempts/kredal",
      {
        method: "PUT",
        body: {
          orderId,
          providerPaymentState,
          providerHoldState,
          providerPayload: {
            ...payment,
            mode: "test",
            verifiedAt: new Date().toISOString(),
          },
        },
      }
    );

    if (!applied.ok) {
      throw new Error("Kredal verified but Zayvi could not apply the state.");
    }

    return NextResponse.json({
      verified: true,
      applied: true,
      providerPaymentState,
      providerHoldState,
      payment,
      state: (applied.data as { state?: unknown }).state || null,
      testMode: true,
    });
  } catch (error) {
    console.error("Kredal test payment verify failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify Kredal test payment.",
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

    const body = await request.json();
    const orderId =
      typeof body?.orderId === "string" ? body.orderId.trim() : "";

    const attempt = await loadAttempt(orderId);
    const connectionId =
      attempt.connectionId || (await loadConnection());

    await cancelKredalPayment(connectionId, attempt.providerReference);

    const payment = await getKredalPayment(
      connectionId,
      attempt.providerReference
    );

    if (payment.payment_state === "cancelled") {
      await callZayviAwsApi("/payment-attempts/kredal", {
        method: "PUT",
        body: {
          orderId,
          providerPaymentState: "cancelled",
          providerHoldState: payment.hold_state ?? null,
          providerPayload: {
            ...payment,
            mode: "test",
            verifiedAt: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({
      cancelled: payment.payment_state === "cancelled",
      providerPaymentState: payment.payment_state || "unknown",
      providerHoldState: payment.hold_state ?? null,
      payment,
      testMode: true,
    });
  } catch (error) {
    console.error("Kredal test payment cancel failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel Kredal test payment.",
      },
      { status: 503 }
    );
  }
}
