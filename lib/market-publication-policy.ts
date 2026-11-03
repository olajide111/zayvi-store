/**
 * Zayvi market-specific publication policy.
 *
 * This module makes deterministic decisions only. It does not publish listings.
 * A score is never sufficient by itself: every hard gate must pass.
 * All decisions are isolated by destination market and fail closed.
 */

export type PublicationMarket = string;
export type ProductRating = number;

export type MarketPublicationInputs = {
  productId: string;
  marketCode: PublicationMarket;
  rating: ProductRating;
  availability:
    | "available"
    | "limited_stock"
    | "temporarily_unavailable"
    | "not_listed"
    | "restricted"
    | "verification_required";
  availabilityVerified: boolean;
  stockCheckedAt?: string;
  maximumStockAgeHours?: number;
  complianceStatus: "unknown" | "pending" | "approved" | "blocked";
  deliveryEstimateDays?: number;
  maximumAcceptableDeliveryDays?: number;
  deliveryEstimateVerified: boolean;
  contribution: number;
  minimumContribution: number;
  evidenceCount: number;
  verifiedEvidenceCount?: number;
  evidenceFresh?: boolean;
  humanApprovalRequired?: boolean;
  globalAutoPublishEnabled?: boolean;
  marketAutoPublishEnabled?: boolean;
  assessmentVersionSupported?: boolean;
  evaluatedAt?: string;
};

export type PublicationDecision = {
  productId: string;
  marketCode: PublicationMarket;
  rating: number;
  decision: "auto_publish" | "admin_review" | "hold" | "blocked";
  publishAllowed: boolean;
  reasons: string[];
  policyVersion: string;
};

export const DEFAULT_PUBLICATION_THRESHOLDS = {
  automaticPublishAt: 85,
  adminReviewAt: 65,
  maximumStockAgeHours: 24,
  minimumEvidenceCount: 2,
  policyVersion: "1.1.0",
} as const;

function validTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function decideMarketPublication(
  input: MarketPublicationInputs,
): PublicationDecision {
  const reasons: string[] = [];
  const evaluatedAt = validTimestamp(input.evaluatedAt) ?? Date.now();

  if (!input.productId.trim() || !input.marketCode.trim()) {
    throw new Error("Product ID and destination market are required.");
  }
  if (!Number.isFinite(input.rating) || input.rating < 0 || input.rating > 100) {
    throw new Error("Product rating must be between 0 and 100.");
  }
  if (!Number.isFinite(input.contribution) || !Number.isFinite(input.minimumContribution)) {
    throw new Error("Contribution values must be finite numbers.");
  }
  if (input.minimumContribution < 0) {
    throw new Error("Minimum contribution cannot be negative.");
  }
  if (input.evidenceCount < 0 || !Number.isInteger(input.evidenceCount)) {
    throw new Error("Evidence count must be a non-negative integer.");
  }

  const blocked = input.complianceStatus === "blocked" ||
    input.availability === "restricted";
  if (blocked) {
    return {
      productId: input.productId,
      marketCode: input.marketCode,
      rating: input.rating,
      decision: "blocked",
      publishAllowed: false,
      reasons: ["Product is restricted or blocked for this market."],
      policyVersion: DEFAULT_PUBLICATION_THRESHOLDS.policyVersion,
    };
  }

  if (input.availability !== "available" && input.availability !== "limited_stock") {
    reasons.push("Product availability is not confirmed for this market.");
  }
  if (!input.availabilityVerified) {
    reasons.push("Supplier availability has not been verified for this market.");
  }

  const stockCheckedAt = validTimestamp(input.stockCheckedAt);
  const maxStockAgeHours = input.maximumStockAgeHours ??
    DEFAULT_PUBLICATION_THRESHOLDS.maximumStockAgeHours;
  if (!Number.isFinite(maxStockAgeHours) || maxStockAgeHours <= 0) {
    throw new Error("Maximum stock age must be a positive number of hours.");
  }
  if (stockCheckedAt === null || stockCheckedAt > evaluatedAt ||
      evaluatedAt - stockCheckedAt > maxStockAgeHours * 60 * 60 * 1000) {
    reasons.push("Stock verification is missing, invalid or stale.");
  }

  if (input.complianceStatus !== "approved") {
    reasons.push("Market compliance approval is incomplete.");
  }
  if (input.deliveryEstimateDays === undefined ||
      !Number.isFinite(input.deliveryEstimateDays) ||
      input.deliveryEstimateDays < 0 ||
      !input.deliveryEstimateVerified) {
    reasons.push("A valid, verified delivery estimate is required.");
  } else if (input.maximumAcceptableDeliveryDays !== undefined &&
      input.deliveryEstimateDays > input.maximumAcceptableDeliveryDays) {
    reasons.push("Verified delivery exceeds the configured market target.");
  }

  if (input.contribution <= 0) reasons.push("Expected contribution is not positive.");
  if (input.contribution < input.minimumContribution) {
    reasons.push("Expected contribution is below the configured market minimum.");
  }

  if (input.evidenceCount < DEFAULT_PUBLICATION_THRESHOLDS.minimumEvidenceCount) {
    reasons.push("At least two supporting evidence records are required.");
  }
  if ((input.verifiedEvidenceCount ?? 0) <
      DEFAULT_PUBLICATION_THRESHOLDS.minimumEvidenceCount) {
    reasons.push("At least two supporting evidence records must be verified.");
  }
  if (input.evidenceFresh !== true) {
    reasons.push("Supporting evidence freshness has not been confirmed.");
  }
  if (input.assessmentVersionSupported !== true) {
    reasons.push("Assessment and scoring version is not approved for publication.");
  }

  if (reasons.length > 0) {
    return {
      productId: input.productId,
      marketCode: input.marketCode,
      rating: input.rating,
      decision: "hold",
      publishAllowed: false,
      reasons,
      policyVersion: DEFAULT_PUBLICATION_THRESHOLDS.policyVersion,
    };
  }

  if (input.humanApprovalRequired ||
      input.rating < DEFAULT_PUBLICATION_THRESHOLDS.automaticPublishAt) {
    return {
      productId: input.productId,
      marketCode: input.marketCode,
      rating: input.rating,
      decision: "admin_review",
      publishAllowed: false,
      reasons: [
        input.humanApprovalRequired
          ? "This product or market requires explicit human approval."
          : "Rating is below the automatic publication threshold.",
      ],
      policyVersion: DEFAULT_PUBLICATION_THRESHOLDS.policyVersion,
    };
  }

  if (input.globalAutoPublishEnabled !== true ||
      input.marketAutoPublishEnabled !== true) {
    return {
      productId: input.productId,
      marketCode: input.marketCode,
      rating: input.rating,
      decision: "admin_review",
      publishAllowed: false,
      reasons: [
        "All quality gates passed, but global and market auto-publication switches are not both enabled.",
      ],
      policyVersion: DEFAULT_PUBLICATION_THRESHOLDS.policyVersion,
    };
  }

  return {
    productId: input.productId,
    marketCode: input.marketCode,
    rating: input.rating,
    decision: "auto_publish",
    publishAllowed: true,
    reasons: [
      "Rating meets the automatic publication threshold.",
      "Market-specific availability, stock freshness, compliance, delivery, evidence, contribution, scoring version and publication switches passed.",
    ],
    policyVersion: DEFAULT_PUBLICATION_THRESHOLDS.policyVersion,
  };
}
