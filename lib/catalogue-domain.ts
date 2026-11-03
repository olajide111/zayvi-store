/**
 * Zayvi catalogue and market domain contracts.
 *
 * These are application-level types, not proof of database connectivity.
 * Persisted monetary values must use fixed-precision decimal strings and an
 * explicit ISO currency code; do not convert them to JavaScript floats.
 */

export type MarketCode = "GB" | "NG";
export type CurrencyCode = "GBP" | "NGN";

export const MARKET_CURRENCY: Readonly<Record<MarketCode, CurrencyCode>> = {
  GB: "GBP",
  NG: "NGN",
};

export type AvailabilityStatus =
  | "unknown"
  | "available"
  | "limited_stock"
  | "out_of_stock"
  | "unavailable"
  | "restricted";

export type ComplianceStatus =
  | "not_assessed"
  | "pending"
  | "approved"
  | "rejected"
  | "restricted";

export type PublicationStatus =
  | "not_listed"
  | "pending_review"
  | "published"
  | "held"
  | "rejected"
  | "withdrawn";

export type SupplierVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

export type SupplierOfferStatus =
  | "pending"
  | "active"
  | "paused"
  | "expired"
  | "rejected";

export type DecimalAmount = string & { readonly __decimalAmount: unique symbol };

export interface MarketPrice {
  market: MarketCode;
  amount: DecimalAmount;
  currency: CurrencyCode;
  observedAt: string | null;
}

export interface ProductMarketReadiness {
  market: MarketCode;
  availability: AvailabilityStatus;
  compliance: ComplianceStatus;
  publication: PublicationStatus;
  requiresHumanApproval: boolean;
  price: MarketPrice | null;
  delivery: {
    minimumDays: number | null;
    maximumDays: number | null;
    evidence: "unknown" | "quoted" | "verified" | "expired" | "disputed";
  };
  assessment: {
    score: number | null;
    confidence: number | null;
    version: string | null;
    assessedAt: string | null;
  };
}

export interface SupplierOffer {
  id: string;
  supplierId: string;
  tenantCatalogueProductId: string;
  market: MarketCode;
  supplierSku: string;
  unitCost: DecimalAmount;
  sourceCurrency: string;
  availability: "unknown" | "available" | "limited_stock" | "out_of_stock" |
    "discontinued" | "temporarily_unavailable";
  observedAt: string | null;
  fetchedAt: string;
  expiresAt: string | null;
  status: SupplierOfferStatus;
}

export function isMarketPriceValid(price: MarketPrice): boolean {
  return MARKET_CURRENCY[price.market] === price.currency &&
    /^\d+(\.\d{1,4})?$/.test(price.amount) &&
    Number.isFinite(Date.parse(price.observedAt ?? ""));
}

/**
 * Missing product-market data is deliberately not treated as available.
 */
export function getMarketAvailability(
  readiness: ProductMarketReadiness | null | undefined,
): AvailabilityStatus {
  return readiness?.availability ?? "unknown";
}
