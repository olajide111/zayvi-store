import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";
import {
  getKredalPayment,
  refundKredalPayment,
} from "@/lib/kredal-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireTestMode() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Kredal test refunds are disabled in production.");
  }

  if (process.env.KREDAL_MODE !== "test") {
    throw new Error("KREDAL_MODE must be set to test.");
  }
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
    const requestedAmountMinor =
      body?.amountMinor === undefined || body?.amountMinor === null
        ? undefined
        : Number(body.amountMinor);

    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json(
        { error: "A valid Zayvi order id is required." },
        { status: 400 }
      );
    }

    const result = await callZayviAwsApi(
      "/payment-attempts/kredal?orderId=" +
        encodeURIComponent(orderId)
    );

    if (!result.ok) {
      throw new Error("Unable to load the Kredal payment attempt.");
    }

    const attempt = (result.data as {
      attempt?: {
        providerReference?: string;
        connectionId?: string;
        amount?: number;
        currency?: string;
      } | null;
    }).attempt;

    if (
      !attempt?.providerReference ||
      !attempt.connectionId ||
      attempt.currency !== "NGN"
    ) {
      throw new Error("A refundable Kredal NGN payment attempt was not found.");
    }

    const totalMinor = Math.round(Number(attempt.amount) * 100);

    if (
      requestedAmountMinor !== undefined &&
      (!Number.isSafeInteger(requestedAmountMinor) ||
        requestedAmountMinor <= 0 ||
        requestedAmountMinor > totalMinor)
    ) {
      return NextResponse.json(
        { error: "Refund amount is invalid." },
        { status: 400 }
      );
    }

    const idempotencyKey =
      "kredal-refund-" +
      orderId.replaceAll("-", "") +
      "-" +
      String(requestedAmountMinor ?? totalMinor);

    await refundKredalPayment({
      connectionId: attempt.connectionId,
      idOrReference: attempt.providerReference,
      idempotencyKey,
      amountMinor: requestedAmountMinor,
    });

    const payment = await getKredalPayment(
      attempt.connectionId,
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

    if (
      providerPaymentState === "refunded" ||
      providerPaymentState === "partially_refunded"
    ) {
      await callZayviAwsApi("/payment-attempts/kredal", {
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
      });
    }

    return NextResponse.json({
      refundRequested: true,
      providerPaymentState: providerPaymentState || "unknown",
      providerHoldState,
      payment,
      testMode: true,
    });
  } catch (error) {
    console.error("Kredal test refund failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to refund Kredal test payment.",
      },
      { status: 503 }
    );
  }
}
