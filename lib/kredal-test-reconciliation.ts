import "server-only";

import { callZayviAwsApi } from "@/lib/aws-api";
import type { KredalPayment } from "@/lib/kredal-pay";

export async function reconcileKredalTestPayment(
  orderId: string,
  payment: KredalPayment,
  providerPaymentState: string,
  providerHoldState: string | null
) {
  const result = await callZayviAwsApi("/payment-attempts/kredal", {
    method: "PUT",
    body: {
      orderId,
      providerPaymentState,
      providerHoldState,
      providerPayload: { ...payment, mode: "test", verifiedAt: new Date().toISOString() },
    },
  });

  const state = (result.data as {
    state?: { ignored?: boolean; reason?: string };
  } | null)?.state;

  if (!result.ok || !state) {
    throw new Error("Kredal returned a payment status, but Zayvi could not save it. Use Verify payment to check again.");
  }

  return {
    applied: state.ignored === false,
    state,
    message: state.ignored ? state.reason || "Zayvi left the order status unchanged." : undefined,
  };
}
