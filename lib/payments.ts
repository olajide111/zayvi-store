// Provider-neutral "is this order really paid?" check.
// Each payment provider (PayPal today; Square is the planned replacement) turns its own
// order/payment response into a ProviderOrder, and verifyPaid decides. Nothing else in the
// store should decide that an order is paid.
import { priceCart, type CartLine } from "./products.ts";

export type PaymentStatus = "paid" | "pending" | "failed";

export type ProviderOrder = {
  /** The provider's view of the money: completed = captured/settled, pending = not yet, failed = declined/voided. */
  state: "completed" | "pending" | "failed";
  /** Amount actually collected, in minor units (pence). */
  amountPence: number;
  currency: string;
  /** What the order is for, as recorded on the provider's side when our server created it. */
  items: CartLine[];
};

export const STORE_CURRENCY = "GBP";

/**
 * Paid only when the provider says the money was collected AND the amount and currency equal
 * the total the catalogue gives for the order's items. Anything else is pending or failed.
 */
export function verifyPaid(order: ProviderOrder): PaymentStatus {
  if (order.state === "failed") return "failed";
  if (order.state !== "completed") return "pending";
  let expectedPence: number;
  try {
    expectedPence = priceCart(order.items).totalPence;
  } catch {
    return "failed"; // items that are not in the catalogue were never a valid order of ours
  }
  if (order.currency !== STORE_CURRENCY) return "failed";
  if (!Number.isInteger(order.amountPence) || order.amountPence !== expectedPence) return "failed";
  return "paid";
}
