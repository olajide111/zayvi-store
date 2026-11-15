import "server-only";

import { zayviCommerceRequest } from "@/lib/database/zayvi-rest";

export type StoredOrder = {
  id: string;
  order_number: string;
  customer_email: string;
  country_code: string | null;
  currency: string;
  total_minor: number;
  order_status: string;
  payment_status: string;
};

export async function getStoredOrder(orderId: string) {
  const query =
    "id=eq." +
    encodeURIComponent(orderId) +
    "&select=id,order_number,customer_email,country_code,currency,total_minor,order_status,payment_status&limit=1";

  const rows = await zayviCommerceRequest<StoredOrder[]>("orders", { query });
  return Array.isArray(rows) ? rows[0] : undefined;
}

export async function createPaymentAttempt(input: {
  orderId: string;
  platform: "kredal" | "square" | "paypal";
  externalPaymentId?: string;
  externalReference?: string;
  amountMinor: number;
  currency: string;
  idempotencyKey?: string;
  checkoutUrl?: string;
}) {
  const rows = await zayviCommerceRequest<Array<{ id: string }>>("payments", {
    method: "POST",
    prefer: "return=representation",
    body: {
      order_id: input.orderId,
      platform: input.platform,
      external_payment_id: input.externalPaymentId ?? null,
      external_reference: input.externalReference ?? null,
      amount_minor: input.amountMinor,
      currency: input.currency,
      status: "pending",
      idempotency_key: input.idempotencyKey ?? null,
      checkout_url: input.checkoutUrl ?? null,
    },
  });

  return Array.isArray(rows) ? rows[0] : undefined;
}

export function assertOrderReadyForPayment(order: StoredOrder | undefined) {
  if (!order) throw new Error("ZAYVI order not found.");
  if (order.order_status !== "awaiting_payment") {
    throw new Error("This order is not awaiting payment.");
  }
  if (order.payment_status !== "pending") {
    throw new Error("This order already has a payment state.");
  }
  if (!Number.isSafeInteger(order.total_minor) || order.total_minor <= 0) {
    throw new Error("This order has an invalid total.");
  }
}
