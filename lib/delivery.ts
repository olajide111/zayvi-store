export type DeliveryAddress = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
};

export type DeliveryQuote = {
  marketCode: "GB" | "NG";
  currency: "GBP" | "NGN";
  shippingMinor: number;
};

export type DraftOrderDetails = {
  customerName: string;
  customerEmail: string;
  phone?: string;
  deliveryAddress?: DeliveryAddress;
  shippingMinor?: number;
};

export type DraftOrderReceipt = {
  orderNumber: string;
  currency: DeliveryQuote["currency"];
  subtotal: number;
  shippingTotal: number;
  total: number;
};

export function isDeliveryQuote(value: unknown, marketCode: string): value is DeliveryQuote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Partial<DeliveryQuote>;
  return quote.marketCode === marketCode &&
    quote.currency === (marketCode === "NG" ? "NGN" : "GBP") &&
    Number.isSafeInteger(quote.shippingMinor) && (quote.shippingMinor ?? -1) >= 0;
}
