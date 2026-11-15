import type {
  PaymentRecommendation,
  PaymentRoutingContext,
} from "@/lib/payments/types";

export function recommendPaymentPlatform({
  countryCode,
  currency,
}: PaymentRoutingContext): PaymentRecommendation {
  const country = countryCode.trim().toUpperCase();
  const money = currency.trim().toUpperCase();

  if (country === "NG" && money === "NGN") {
    return {
      primary: "kredal",
      alternatives: ["paypal"],
      reason: "Kredal Pay is the primary ZAYVI payment platform for NGN checkout.",
    };
  }

  if (country === "GB" && money === "GBP") {
    return {
      primary: "square",
      alternatives: ["paypal"],
      reason: "Square is the primary ZAYVI card platform for UK GBP checkout.",
    };
  }

  return {
    primary: "paypal",
    alternatives: [],
    reason: "PayPal is the current fallback for supported international checkout.",
  };
}
