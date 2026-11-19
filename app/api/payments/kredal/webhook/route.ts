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
  "transfer.received",
  "connection.approved",
  "connection.revoked",
]);

export async function POST(request: NextRequest) {
  const secret = process.env.KREDAL_WEBHOOK_SECRET;

  if (!secret) {
    console.error("Kredal webhook signing secret is missing");
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
    console.warn("Kredal webhook rejected: invalid or stale signature");
    return NextResponse.json(
      { error: "Invalid or stale Kredal signature." },
      { status: 401 }
    );
  }

  let payload: {
    id?: unknown;
    type?: unknown;
    sequence?: unknown;
    livemode?: unknown;
    data?: unknown;
  };

  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("Expected a Kredal event object");
    }
    payload = parsed;
  } catch {
    console.warn("Kredal webhook rejected: invalid payload");
    return NextResponse.json(
      { error: "Invalid Kredal webhook payload." },
      { status: 400 }
    );
  }

  const eventId = typeof payload.id === "string" ? payload.id.trim() : "";
  const eventType = typeof payload.type === "string" ? payload.type.trim() : "";
  const sequence = payload.sequence;

  if (
    !/^evt_[A-Za-z0-9._:-]{1,180}$/.test(eventId) ||
    !ALLOWED_EVENTS.has(eventType) ||
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    sequence < 0 ||
    payload.livemode !== false ||
    !payload.data ||
    typeof payload.data !== "object" ||
    Array.isArray(payload.data)
  ) {
    console.warn("Kredal webhook rejected: unsupported event envelope");
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
    console.error("Kredal webhook could not be persisted", {
      eventId,
      eventType,
      sequence,
      backendStatus: result.status,
    });
    return NextResponse.json(
      { error: "Kredal event could not be persisted." },
      { status: 502 }
    );
  }

  const outcome = result.data as {
    duplicate?: boolean;
    applied?: boolean;
    ignored?: boolean;
  } | null;
  const eventContext = { eventId, eventType, sequence };
  if (outcome?.duplicate) {
    console.info("Kredal webhook duplicate", eventContext);
  } else if (outcome?.ignored) {
    console.info("Kredal webhook ignored", eventContext);
  } else if (outcome?.applied) {
    console.info("Kredal webhook applied", eventContext);
  } else {
    console.warn("Kredal webhook stored without applying an update", eventContext);
  }

  return NextResponse.json({ received: true });
}
