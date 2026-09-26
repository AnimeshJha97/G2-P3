import { INITIAL_SCORING_PARAMETERS } from "../config/scoring-config.js";
import type { ScoringConfig } from "../types/score.js";

// Calibrated from the real-model labeled-case relevance distributions. Clearly
// irrelevant cases top out at 0.081, while clearly relevant cases start at
// 0.170; borderline and relevant cases overlap above that separation.
export const EVALUATION_SCORING_CONFIG: ScoringConfig = {
  topK: INITIAL_SCORING_PARAMETERS.topK,
  semanticNeighborWeights: [
    ...INITIAL_SCORING_PARAMETERS.semanticNeighborWeights,
  ],
  semanticWeight: INITIAL_SCORING_PARAMETERS.semanticWeight,
  lexicalWeight: INITIAL_SCORING_PARAMETERS.lexicalWeight,
  relevanceLow: 0.1,
  relevanceHigh: 0.35,
};
