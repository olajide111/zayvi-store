import { NextRequest, NextResponse } from "next/server";

import { callZayviAwsApi } from "@/lib/aws-api";
import { verifyKredalWebhookSignature } from "@/lib/kredal-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "payment.paid",
  "payment.held",
  "payment.released",
  "payment.refunded",
  "payment.cancelled",
  "payment.failed",
  "payment.arrival_chosen",
  "settlement.updated",
  "transfer.received",
  "connection.approved",
  "connection.revoked",
]);

export async function POST(request: NextRequest) {
  const secret = process.env.KREDAL_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Kredal webhook verification is not configured." },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-kredal-signature");

  if (
    !verifyKredalWebhookSignature({
      rawBody,
      signatureHeader,
      secret,
    })
  ) {
    return NextResponse.json(
      { error: "Invalid or stale Kredal signature." },
      { status: 401 }
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid Kredal webhook payload." },
      { status: 400 }
    );
  }

  const event = payload as {
    id?: unknown;
    type?: unknown;
  };

  const eventId = typeof event.id === "string" ? event.id.trim() : "";
  const eventType = typeof event.type === "string" ? event.type.trim() : "";

  if (
    !/^[A-Za-z0-9._:-]{1,180}$/.test(eventId) ||
    !ALLOWED_EVENTS.has(eventType)
  ) {
    return NextResponse.json(
      { error: "Unsupported Kredal webhook event." },
      { status: 400 }
    );
  }

  const result = await callZayviAwsApi("/payment-events/kredal", {
    method: "POST",
    body: {
      eventId,
      eventType,
      payload,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Kredal event could not be persisted." },
      { status: 502 }
    );
  }

  return NextResponse.json({ received: true });
}
