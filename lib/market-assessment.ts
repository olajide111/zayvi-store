/**
 * Zayvi explainable market-readiness scoring rubric.
 *
 * This is a deterministic baseline for admin review, not an AI model and not
 * proof of demand or product quality. Inputs must be evidence-backed,
 * destination-market specific and normalised to 0..100 by validated workflows.
 * The publication policy remains a separate, stricter set of hard gates.
 */

export const MARKET_ASSESSMENT_VERSION = "baseline-1.0.0";

export const MARKET_ASSESSMENT_WEIGHTS = {
  supplierReliability: 20,
  availability: 20,
  contribution: 20,
  delivery: 15,
  demand: 10,
  compliance: 10,
  evidenceQuality: 5,
} as const;

export type AssessmentComponent =
  keyof typeof MARKET_ASSESSMENT_WEIGHTS;

export type MarketAssessmentInputs = Partial<
  Record<AssessmentComponent, number>
> & {
  marketCode: string;
  productId: string;
  assessedAt?: string;
};

export type MarketAssessmentResult = {
  productId: string;
  marketCode: string;
  version: string;
  assessedAt: string;
  rating: number | null;
  confidence: number;
  status: "assessable" | "insufficient_evidence";
  components: Array<{
    name: AssessmentComponent;
    weight: number;
    score: number | null;
    weightedContribution: number;
  }>;
  reasons: string[];
};

const CRITICAL_COMPONENTS: AssessmentComponent[] = [
  "supplierReliability",
  "availability",
  "contribution",
  "compliance",
  "evidenceQuality",
];

function validateScore(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a finite score between 0 and 100.`);
  }
}

export function assessMarketReadinessScore(
  input: MarketAssessmentInputs,
): MarketAssessmentResult {
  if (!input.productId.trim() || !input.marketCode.trim()) {
    throw new Error("Product ID and destination market are required.");
  }

  const components = (
    Object.keys(MARKET_ASSESSMENT_WEIGHTS) as AssessmentComponent[]
  ).map((name) => {
    const score = input[name];
    if (score !== undefined) validateScore(name, score);
    const weight = MARKET_ASSESSMENT_WEIGHTS[name];
    return {
      name,
      weight,
      score: score ?? null,
      weightedContribution: score === undefined ? 0 : score * weight / 100,
    };
  });

  const missingCritical = CRITICAL_COMPONENTS.filter(
    (name) => input[name] === undefined,
  );
  const availableWeight = components.reduce(
    (total, item) => total + (item.score === null ? 0 : item.weight),
    0,
  );
  const confidence = Math.round(availableWeight);

  const reasons: string[] = [];
  if (missingCritical.length) {
    reasons.push(
      `Critical evidence is missing for: ${missingCritical.join(", ")}.`,
    );
  }
  if (input.delivery === undefined) {
    reasons.push("Verified delivery performance or estimate is missing.");
  }
  if (input.demand === undefined) {
    reasons.push("Destination-market demand evidence is missing.");
  }

  const assessedAt = input.assessedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(assessedAt))) {
    throw new Error("Assessment timestamp must be a valid ISO date.");
  }

  if (missingCritical.length) {
    return {
      productId: input.productId,
      marketCode: input.marketCode,
      version: MARKET_ASSESSMENT_VERSION,
      assessedAt,
      rating: null,
      confidence,
      status: "insufficient_evidence",
      components,
      reasons: [
        ...reasons,
        "No overall rating is issued until all critical evidence categories are assessed.",
      ],
    };
  }

  const rating = Math.round(
    components.reduce((total, item) => total + item.weightedContribution, 0),
  );

  return {
    productId: input.productId,
    marketCode: input.marketCode,
    version: MARKET_ASSESSMENT_VERSION,
    assessedAt,
    rating,
    confidence,
    status: "assessable",
    components,
    reasons: [
      "Rating is a provisional weighted assessment for this destination market only.",
      ...reasons,
      "This score does not approve compliance, verify supplier claims or authorise publication.",
    ],
  };
}
