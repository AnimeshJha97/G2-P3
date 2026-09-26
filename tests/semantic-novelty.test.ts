import { describe, expect, it } from "vitest";

import {
  aggregateTopKSemanticSimilarity,
  calculateSemanticNovelty,
  selectTopSemanticMatches,
} from "../src/scoring/semantic-novelty.js";

const weights = [0.6, 0.3, 0.1];

describe("semantic neighbor selection", () => {
  it("sorts descending, selects Top-K, and does not mutate its input", () => {
    const matches = [
      { submissionId: "low", similarity: 0.2 },
      { submissionId: "high", similarity: 0.9 },
      { submissionId: "middle", similarity: 0.6 },
    ];

    expect(selectTopSemanticMatches(matches, 2).map(({ submissionId }) => submissionId))
      .toEqual(["high", "middle"]);
    expect(matches.map(({ submissionId }) => submissionId)).toEqual([
      "low",
      "high",
      "middle",
    ]);
  });
});

describe("aggregateTopKSemanticSimilarity", () => {
  it("uses the documented weighted Top-3 formula", () => {
    expect(
      aggregateTopKSemanticSimilarity([0.3, 0.9, 0.6], 3, weights),
    ).toBeCloseTo(0.75);
  });

  it("renormalizes active weights when fewer than K neighbors exist", () => {
    expect(aggregateTopKSemanticSimilarity([0.9, 0.6], 3, weights)).toBeCloseTo(
      0.8,
    );
  });

  it("rejects an empty baseline", () => {
    expect(() => aggregateTopKSemanticSimilarity([], 3, weights)).toThrow(
      "At least one semantic similarity is required",
    );
  });

  it("rejects invalid Top-K weight configuration", () => {
    expect(() => aggregateTopKSemanticSimilarity([0.9], 3, [1])).toThrow(
      "semanticNeighborWeights must contain at least topK values",
    );
    expect(() => aggregateTopKSemanticSimilarity([0.9], 1, [0])).toThrow(
      "Active semantic neighbor weights must have a positive sum",
    );
  });
});

describe("calculateSemanticNovelty", () => {
  it("returns one minus aggregated similarity within the unit interval", () => {
    expect(calculateSemanticNovelty(0.75)).toBe(0.25);
    expect(calculateSemanticNovelty(1.2)).toBe(0);
    expect(calculateSemanticNovelty(-0.2)).toBe(1);
  });
});
