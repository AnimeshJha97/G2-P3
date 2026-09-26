import type { ScoringConfig } from "../types/score.js";

export const INITIAL_SCORING_PARAMETERS = {
  topK: 3,
  semanticNeighborWeights: [0.6, 0.3, 0.1],
  semanticWeight: 0.85,
  lexicalWeight: 0.15,
} as const;

const WEIGHT_SUM_TOLERANCE = 1e-9;

const assertFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`);
  }
};

export const validateScoringConfig = (config: ScoringConfig): void => {
  if (!Number.isInteger(config.topK) || config.topK <= 0) {
    throw new Error("topK must be a positive integer");
  }

  if (config.semanticNeighborWeights.length < config.topK) {
    throw new Error("semanticNeighborWeights must contain at least topK values");
  }

  for (const weight of config.semanticNeighborWeights) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("semanticNeighborWeights must be finite and non-negative");
    }
  }

  const activeWeightSum = config.semanticNeighborWeights
    .slice(0, config.topK)
    .reduce((sum, weight) => sum + weight, 0);

  if (activeWeightSum <= 0) {
    throw new Error("Active semantic neighbor weights must have a positive sum");
  }

  assertFinite(config.semanticWeight, "semanticWeight");
  assertFinite(config.lexicalWeight, "lexicalWeight");

  if (config.semanticWeight < 0 || config.lexicalWeight < 0) {
    throw new Error("Semantic and lexical weights must be non-negative");
  }

  if (
    Math.abs(config.semanticWeight + config.lexicalWeight - 1) >
    WEIGHT_SUM_TOLERANCE
  ) {
    throw new Error("Semantic and lexical weights must sum to 1");
  }

  assertFinite(config.relevanceLow, "relevanceLow");
  assertFinite(config.relevanceHigh, "relevanceHigh");

  if (config.relevanceHigh <= config.relevanceLow) {
    throw new Error("relevanceHigh must be greater than relevanceLow");
  }
};
