import { INITIAL_SCORING_PARAMETERS } from "../config/scoring-config.js";
import type { ScoringConfig } from "../types/score.js";

// Relevance thresholds are intentionally left as the full cosine-similarity
// range for the evaluation-framework sprint. Sprint 7 will calibrate them from
// observed labeled-case distributions; this does not alter scorer defaults.
export const EVALUATION_SCORING_CONFIG: ScoringConfig = {
  topK: INITIAL_SCORING_PARAMETERS.topK,
  semanticNeighborWeights: [
    ...INITIAL_SCORING_PARAMETERS.semanticNeighborWeights,
  ],
  semanticWeight: INITIAL_SCORING_PARAMETERS.semanticWeight,
  lexicalWeight: INITIAL_SCORING_PARAMETERS.lexicalWeight,
  relevanceLow: 0,
  relevanceHigh: 1,
};
