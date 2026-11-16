import { NextRequest, NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import { callZayviAwsApi } from "@/lib/aws-api";
import {
  listKredalEvents,
  type KredalEventEnvelope,
} from "@/lib/kredal-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireTestMode() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Kredal event catch-up is disabled in production.");
  }

  if (process.env.KREDAL_MODE !== "test") {
    throw new Error("KREDAL_MODE must be set to test.");
  }
}

function isEnvelope(event: unknown): event is KredalEventEnvelope {
  if (!event || typeof event !== "object" || Array.isArray(event)) return false;

  const value = event as Record<string, unknown>;

  return (
    typeof value.id === "string" &&
    /^evt_[A-Za-z0-9._:-]{1,180}$/.test(value.id) &&
    typeof value.type === "string" &&
    Number.isSafeInteger(Number(value.sequence)) &&
    Number(value.sequence) >= 0 &&
    value.livemode === false &&
    !!value.data &&
    typeof value.data === "object" &&
    !Array.isArray(value.data)
  );
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    requireTestMode();

    const local = await callZayviAwsApi("/payment-events/kredal");

    if (!local.ok) {
      throw new Error("Unable to read Zayvi's Kredal event ledger.");
    }

    const localEvents = (local.data as {
      events?: Array<{ sequence?: number | null }>;
    }).events;

    let after = 0;

    if (Array.isArray(localEvents)) {
      after = localEvents.reduce((max, event) => {
        const sequence = Number(event.sequence);
        return Number.isSafeInteger(sequence) && sequence > max ? sequence : max;
      }, 0);
    }

    let applied = 0;
    let duplicates = 0;
    let ignored = 0;
    let fetched = 0;
    let pages = 0;
    let hasMore = true;

    while (hasMore && pages < 10) {
      const page = await listKredalEvents(after || undefined);
      const pageEvents = Array.isArray(page.events)
        ? page.events
        : Array.isArray(page.data)
          ? page.data
          : [];

      for (const event of pageEvents) {
        if (!isEnvelope(event)) continue;

        fetched += 1;

        const stored = await callZayviAwsApi("/payment-events/kredal", {
          method: "POST",
          body: {
            eventId: event.id,
            eventType: event.type,
            payload: event,
          },
        });

        if (!stored.ok) {
          throw new Error(
            "A Kredal catch-up event could not be persisted or reconciled."
          );
        }

        const result = stored.data as {
          duplicate?: boolean;
          ignored?: boolean;
          applied?: boolean;
        };

        if (result.duplicate) duplicates += 1;
        else if (result.ignored) ignored += 1;
        else if (result.applied) applied += 1;

        if (event.sequence > after) after = event.sequence;
      }

      pages += 1;
      hasMore = page.has_more === true;

      if (hasMore) {
        const next = Number(page.next_after);
        if (Number.isSafeInteger(next) && next > after) {
          after = next;
        } else if (pageEvents.length === 0) {
          break;
        }
      }
    }

    return NextResponse.json({
      caughtUp: true,
      fetched,
      applied,
      duplicates,
      ignored,
      lastSequence: after,
      pages,
      hasMore,
      testMode: true,
    });
  } catch (error) {
    console.error("Kredal catch-up failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to catch up Kredal events.",
      },
      { status: 503 }
    );
  }
}
