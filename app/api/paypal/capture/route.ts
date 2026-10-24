import { NextRequest, NextResponse } from "next/server";
import { captureIfApproved, fromPayPal, paypalConfigured } from "@/lib/paypal";
import { verifyPaid } from "@/lib/payments";

// Called by /success after PayPal sends the buyer back (?token=<order id>).
// Captures the approved order with the server secret and says whether it is really paid.
export async function POST(req: NextRequest) {
  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string" || !/^[A-Z0-9]{5,40}$/.test(orderId)) {
    return NextResponse.json({ status: "failed", reason: "unknown-order" }, { status: 400 });
  }
  if (!paypalConfigured()) return NextResponse.json({ status: "pending" }, { status: 503 });
  try {
    const status = verifyPaid(fromPayPal(await captureIfApproved(orderId)));
    return NextResponse.json({ status });
  } catch (err) {
    console.error("PayPal capture/verify failed", err);
    return NextResponse.json({ status: "pending" }, { status: 502 });
  }
}
