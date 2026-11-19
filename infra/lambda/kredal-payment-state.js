function mapKredalPaymentState({ payment_state, hold_state }) {
  switch (payment_state) {
    case "created":
    case "pending":
      return { attemptStatus: "pending", orderPaymentStatus: "pending", orderStatusMode: "keep_pending" };
    case "succeeded":
      if (hold_state === "held" || hold_state === "disputed") {
        return { attemptStatus: "authorised", orderPaymentStatus: "pending", orderStatusMode: "keep_pending" };
      }
      if (hold_state == null || hold_state === "" || hold_state === "released") {
        return { attemptStatus: "captured", orderPaymentStatus: "paid", orderStatusMode: "confirm" };
      }
      return null;
    case "failed":
    case "expired":
      return { attemptStatus: "failed", orderPaymentStatus: "failed", orderStatusMode: "keep_pending" };
    case "cancelled":
      return { attemptStatus: "cancelled", orderPaymentStatus: "failed", orderStatusMode: "cancel" };
    case "partially_refunded":
    case "refunded":
      return { attemptStatus: payment_state, orderPaymentStatus: payment_state, orderStatusMode: "preserve" };
    default:
      return null;
  }
}

module.exports = { mapKredalPaymentState };
