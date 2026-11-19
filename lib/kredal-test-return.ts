export function returnedKredalOrderId(value: unknown): string {
  return typeof value === "string" &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : "";
}

export function kredalTestReturnPath(orderId: string) {
  return "/admin/payments?" + new URLSearchParams({ kredal_return: "1", order_id: orderId });
}
