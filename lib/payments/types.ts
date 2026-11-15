export type PaymentPlatform = "kredal" | "square" | "paypal";

export type PaymentRoutingContext = {
  countryCode: string;
  currency: string;
};

export type PaymentRecommendation = {
  primary: PaymentPlatform;
  alternatives: PaymentPlatform[];
  reason: string;
};

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "held"
  | "partially_refunded"
  | "refunded"
  | "cancelled";
