import { describe, expect, it } from "vitest";

import {
  INITIAL_SCORING_PARAMETERS,
  validateScoringConfig,
} from "../src/config/scoring-config.js";
import type { ScoringConfig } from "../src/types/score.js";

const validConfig = (): ScoringConfig => ({
  topK: INITIAL_SCORING_PARAMETERS.topK,
  semanticNeighborWeights: [
    ...INITIAL_SCORING_PARAMETERS.semanticNeighborWeights,
  ],
  semanticWeight: INITIAL_SCORING_PARAMETERS.semanticWeight,
  lexicalWeight: INITIAL_SCORING_PARAMETERS.lexicalWeight,
  relevanceLow: 0.3,
  relevanceHigh: 0.6,
});

describe("validateScoringConfig", () => {
  it("accepts the documented initial weights with caller-supplied thresholds", () => {
    expect(() => validateScoringConfig(validConfig())).not.toThrow();
  });

  it.each([
    [{ topK: 0 }, "topK must be a positive integer"],
    [
      { topK: 4 },
      "semanticNeighborWeights must contain at least topK values",
    ],
    [
      { semanticNeighborWeights: [0, 0, 0] },
      "Active semantic neighbor weights must have a positive sum",
    ],
    [
      { semanticNeighborWeights: [0.6, -0.3, 0.1] },
      "semanticNeighborWeights must be finite and non-negative",
    ],
    [
      { semanticWeight: 0.7, lexicalWeight: 0.2 },
      "Semantic and lexical weights must sum to 1",
    ],
    [
      { semanticWeight: -0.1, lexicalWeight: 1.1 },
      "Semantic and lexical weights must be non-negative",
    ],
    [
      { relevanceLow: 0.6, relevanceHigh: 0.3 },
      "relevanceHigh must be greater than relevanceLow",
    ],
  ])("rejects invalid configuration %o", (override, message) => {
    expect(() => validateScoringConfig({ ...validConfig(), ...override })).toThrow(
      message,
    );
  });
});
