import { describe, expect, it } from "vitest";

import {
  calculateFinalScore,
  calculateLexicalNovelty,
  calculateRawNovelty,
  calculateRelevanceGate,
  clampToUnitInterval,
} from "../src/index.js";

describe("novelty calculations", () => {
  it("calculates lexical novelty from maximum lexical similarity", () => {
    expect(calculateLexicalNovelty(0.7)).toBeCloseTo(0.3);
    expect(calculateLexicalNovelty(1.2)).toBe(0);
    expect(calculateLexicalNovelty(-0.2)).toBe(1);
  });

  it("uses the configured semantic and lexical weights for raw novelty", () => {
    expect(calculateRawNovelty(0.2, 0.8, 0.85, 0.15)).toBeCloseTo(0.29);
  });

  it("clamps scores to the unit interval", () => {
    expect(clampToUnitInterval(-0.1)).toBe(0);
    expect(clampToUnitInterval(0.4)).toBe(0.4);
    expect(clampToUnitInterval(1.1)).toBe(1);
    expect(calculateRawNovelty(1, 1, 2, 1)).toBe(1);
  });
});

describe("calculateRelevanceGate", () => {
  const low = 0.3;
  const high = 0.6;

  it.each([
    [0.2, 0],
    [0.3, 0],
    [0.45, 0.5],
    [0.6, 1],
    [0.8, 1],
  ])("maps relevance %s to gate %s", (relevance, expected) => {
    expect(calculateRelevanceGate(relevance, low, high)).toBeCloseTo(expected);
  });

  it("rejects reversed or equal thresholds", () => {
    expect(() => calculateRelevanceGate(0.5, 0.6, 0.3)).toThrow(
      "relevanceHigh must be greater than relevanceLow",
    );
    expect(() => calculateRelevanceGate(0.5, 0.3, 0.3)).toThrow(
      "relevanceHigh must be greater than relevanceLow",
    );
  });
});

describe("calculateFinalScore", () => {
  it("multiplies raw novelty by the relevance gate and clamps the result", () => {
    expect(calculateFinalScore(0.8, 0)).toBe(0);
    expect(calculateFinalScore(0.8, 0.5)).toBe(0.4);
    expect(calculateFinalScore(0.8, 1)).toBe(0.8);
    expect(calculateFinalScore(2, 1)).toBe(1);
  });
});
