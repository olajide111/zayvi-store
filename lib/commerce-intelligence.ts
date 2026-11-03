/**
 * Market-specific commerce types and deterministic contribution calculator.
 * Monetary inputs must already be converted to the destination market currency.
 * Tax/duty rates must come from verified, dated market configuration.
 */

export type MarketCode = string;
export type FulfilmentModel = "own_stock" | "supplier_fulfilled";
export type MarketAvailability =
  | "available"
  | "limited_stock"
  | "temporarily_unavailable"
  | "not_listed"
  | "restricted"
  | "verification_required";

export const INITIAL_MARKETS = {
  GB: { countryCode: "GB", name: "United Kingdom", currency: "GBP", locale: "en-GB" },
  NG: { countryCode: "NG", name: "Nigeria", currency: "NGN", locale: "en-NG" },
} as const;

export type SupplierOffer = {
  id: string;
  supplierId: string;
  productId: string;
  marketCode: MarketCode;
  availability: MarketAvailability;
  fulfilmentModel: FulfilmentModel;
  unitCost: { amount: number; currency: string };
  shippingCostPerUnit: { amount: number; currency: string };
  stockQuantity?: number;
  minimumOrderQuantity?: number;
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
  deliveryEstimateSource?: "supplier_quoted" | "platform_observed" | "independently_verified";
  lastAvailabilityCheckAt?: string;
  evidenceUrls: string[];
};

export type ProductMarket = {
  productId: string;
  marketCode: MarketCode;
  enabledForSale: boolean;
  availability: MarketAvailability;
  customerPrice?: { amount: number; currency: string };
  preferredSupplierOfferId?: string;
  complianceStatus: "unknown" | "pending" | "approved" | "blocked";
  lastReviewedAt?: string;
};

export type FxEvidence = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  source: string;
  observedAt: string;
};

export type MarketCostInputs = {
  customerPrice: number;
  salesTaxRate: number;
  priceIncludesSalesTax: boolean;
  sellerCollectsSalesTax: boolean;
  supplierUnitCost: number;
  inboundShipping: number;
  customsDuty: number;
  importTax: number;
  fulfilmentAndPackaging: number;
  paymentFeeRate: number;
  paymentFixedFee: number;
  platformFeeRate: number;
  marketingCostPerOrder: number;
  returnsAllowance: number;
};

export type MarketEconomics = {
  customerPrice: number;
  taxCollectedOrIncluded: number;
  netSalesRevenue: number;
  totalVariableCost: number;
  contribution: number;
  contributionMarginPercent: number;
  breakEvenCustomerPrice: number;
  currency: string;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateMarketEconomics(
  currency: string,
  input: MarketCostInputs,
): MarketEconomics {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(name + " must be a finite, non-negative number.");
    }
  }
  if (input.salesTaxRate >= 1 || input.paymentFeeRate >= 1 || input.platformFeeRate >= 1) {
    throw new Error("Tax and fee rates must be decimal values below 1.");
  }

  const tax = input.sellerCollectsSalesTax
    ? input.priceIncludesSalesTax
      ? input.customerPrice * input.salesTaxRate / (1 + input.salesTaxRate)
      : input.customerPrice * input.salesTaxRate
    : 0;
  const netRevenue = input.customerPrice - tax;
  const paymentFee = input.customerPrice * input.paymentFeeRate + input.paymentFixedFee;
  const platformFee = input.customerPrice * input.platformFeeRate;
  const nonPercentageCosts =
    input.supplierUnitCost + input.inboundShipping + input.customsDuty +
    input.importTax + input.fulfilmentAndPackaging + input.paymentFixedFee +
    input.marketingCostPerOrder + input.returnsAllowance;
  const totalCost =
    input.supplierUnitCost + input.inboundShipping + input.customsDuty +
    input.importTax + input.fulfilmentAndPackaging + paymentFee + platformFee +
    input.marketingCostPerOrder + input.returnsAllowance;
  const contribution = netRevenue - totalCost;
  const revenueFactor = input.sellerCollectsSalesTax
    ? input.priceIncludesSalesTax
      ? 1 / (1 + input.salesTaxRate)
      : 1 - input.salesTaxRate
    : 1;
  const denominator = revenueFactor - input.paymentFeeRate - input.platformFeeRate;
  const breakEven = denominator > 0
    ? (nonPercentageCosts - input.paymentFixedFee) / denominator
    : Number.POSITIVE_INFINITY;

  return {
    customerPrice: roundMoney(input.customerPrice),
    taxCollectedOrIncluded: roundMoney(tax),
    netSalesRevenue: roundMoney(netRevenue),
    totalVariableCost: roundMoney(totalCost),
    contribution: roundMoney(contribution),
    contributionMarginPercent: netRevenue > 0 ? roundMoney(contribution / netRevenue * 100) : 0,
    breakEvenCustomerPrice: Number.isFinite(breakEven) ? roundMoney(Math.max(0, breakEven)) : Number.POSITIVE_INFINITY,
    currency,
  };
}

export function assessMarketReadiness(input: {
  availability: MarketAvailability;
  complianceStatus: ProductMarket["complianceStatus"];
  enabledForSale: boolean;
  deliveryMaxDays?: number;
  maximumAcceptableDeliveryDays?: number;
  contribution: number;
  minimumContribution?: number;
  evidenceCount: number;
}): { recommendation: "recommend" | "review" | "do_not_list"; reasons: string[] } {
  const reasons: string[] = [];
  if (input.availability !== "available" && input.availability !== "limited_stock") {
    reasons.push("Supplier availability is not confirmed for this market.");
  }
  if (input.complianceStatus !== "approved") reasons.push("Market compliance approval is not confirmed.");
  if (!input.enabledForSale) reasons.push("Product is not enabled for sale in this market.");
  if (input.deliveryMaxDays === undefined) reasons.push("A reliable delivery window is missing.");
  else if (input.maximumAcceptableDeliveryDays !== undefined &&
    input.deliveryMaxDays > input.maximumAcceptableDeliveryDays) {
    reasons.push("Delivery exceeds this market's configured target.");
  }
  if (input.contribution <= 0) reasons.push("Expected contribution is not positive.");
  if (input.minimumContribution !== undefined && input.contribution < input.minimumContribution) {
    reasons.push("Expected contribution is below the configured minimum.");
  }
  if (input.evidenceCount === 0) reasons.push("Supporting evidence is missing.");

  if (reasons.some((reason) =>
    reason.includes("not confirmed") || reason.includes("not approved") ||
    reason.includes("not enabled") || reason.includes("not positive")
  )) return { recommendation: "do_not_list", reasons };
  if (reasons.length) return { recommendation: "review", reasons };
  return {
    recommendation: "recommend",
    reasons: ["Market checks passed; human approval is still required before listing."],
  };
}
