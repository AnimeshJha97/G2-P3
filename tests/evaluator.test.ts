import { describe, expect, it, vi } from "vitest";

import {
  evaluateScoredCase,
  groupResultsByCategory,
  scoreEvaluationCases,
  summarizeEvaluation,
  type LabeledEvaluationCase,
  type NoveltyScoreResult,
} from "../src/index.js";

const makeCase = (
  id: string,
  category: LabeledEvaluationCase["category"],
  expectation: LabeledEvaluationCase["expectation"],
): LabeledEvaluationCase => ({
  id,
  category,
  candidate: {
    id: `candidate-${id}`,
    headline: `Headline for ${id}`,
    body: `Body for ${id}`,
    perspective: "suggestion",
  },
  expectation,
  rationale: `Rationale for ${id}`,
});

const makeScore = ({
  finalScore,
  rawNovelty,
  semanticNovelty = rawNovelty,
  lexicalNovelty = rawNovelty,
  relevance,
  relevanceGate = relevance,
}: {
  finalScore: number;
  rawNovelty: number;
  semanticNovelty?: number;
  lexicalNovelty?: number;
  relevance: number;
  relevanceGate?: number;
}): NoveltyScoreResult => ({
  finalScore,
  semantic: {
    topK: 3,
    aggregatedSimilarity: 1 - semanticNovelty,
    novelty: semanticNovelty,
  },
  lexical: {
    maxSimilarity: 1 - lexicalNovelty,
    novelty: lexicalNovelty,
  },
  rawNovelty,
  relevance: {
    similarity: relevance,
    gate: relevanceGate,
  },
  nearestNeighbors: [],
});

describe("evaluation expectation handling", () => {
  it("passes only when every defined inclusive bound passes", () => {
    const evaluationCase = makeCase("all-bounds", "novel_relevant", {
      minFinalScore: 0.4,
      maxFinalScore: 0.6,
      minRawNovelty: 0.7,
      maxRawNovelty: 0.8,
      minRelevance: 0.5,
      maxRelevance: 0.7,
    });
    const score = makeScore({
      finalScore: 0.4,
      rawNovelty: 0.8,
      relevance: 0.6,
    });

    const result = evaluateScoredCase(evaluationCase, score);

    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(6);
    expect(result.checks.every(({ passed }) => passed)).toBe(true);
  });

  it("retains each failed expectation with expected and actual values", () => {
    const evaluationCase = makeCase("failed", "novel_irrelevant", {
      minRawNovelty: 0.8,
      maxRelevance: 0.3,
      maxFinalScore: 0.2,
    });
    const score = makeScore({
      finalScore: 0.25,
      rawNovelty: 0.75,
      relevance: 0.4,
    });

    const result = evaluateScoredCase(evaluationCase, score);

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual([
      expect.objectContaining({
        expectation: "maxFinalScore",
        expected: 0.2,
        actual: 0.25,
        passed: false,
      }),
      expect.objectContaining({
        expectation: "minRawNovelty",
        expected: 0.8,
        actual: 0.75,
        passed: false,
      }),
      expect.objectContaining({
        expectation: "maxRelevance",
        expected: 0.3,
        actual: 0.4,
        passed: false,
      }),
    ]);
  });

  it("scores every candidate through an injected deterministic scorer", async () => {
    const cases = [
      makeCase("first", "duplicate", { maxFinalScore: 0.2 }),
      makeCase("second", "common", { maxFinalScore: 0.6 }),
    ];
    const scores = [
      makeScore({ finalScore: 0.1, rawNovelty: 0.2, relevance: 0.8 }),
      makeScore({ finalScore: 0.7, rawNovelty: 0.8, relevance: 0.9 }),
    ];
    const scorer = vi
      .fn<(candidate: LabeledEvaluationCase["candidate"]) => Promise<NoveltyScoreResult>>()
      .mockResolvedValueOnce(scores[0])
      .mockResolvedValueOnce(scores[1]);

    const results = await scoreEvaluationCases(cases, scorer);

    expect(scorer.mock.calls.map(([candidate]) => candidate.id)).toEqual([
      "candidate-first",
      "candidate-second",
    ]);
    expect(results.map(({ passed }) => passed)).toEqual([true, false]);
  });
});

describe("evaluation aggregation", () => {
  it("groups categories and calculates all means and summary metrics", () => {
    const results = [
      evaluateScoredCase(
        makeCase("duplicate-pass", "duplicate", { maxFinalScore: 0.2 }),
        makeScore({
          finalScore: 0.1,
          rawNovelty: 0.2,
          semanticNovelty: 0.15,
          lexicalNovelty: 0.25,
          relevance: 0.8,
          relevanceGate: 1,
        }),
      ),
      evaluateScoredCase(
        makeCase("duplicate-fail", "duplicate", { maxFinalScore: 0.2 }),
        makeScore({
          finalScore: 0.3,
          rawNovelty: 0.4,
          semanticNovelty: 0.35,
          lexicalNovelty: 0.45,
          relevance: 0.6,
          relevanceGate: 0.75,
        }),
      ),
      evaluateScoredCase(
        makeCase("novel-pass", "novel_relevant", { minFinalScore: 0.5 }),
        makeScore({
          finalScore: 0.7,
          rawNovelty: 0.8,
          semanticNovelty: 0.75,
          lexicalNovelty: 0.85,
          relevance: 0.9,
          relevanceGate: 1,
        }),
      ),
    ];

    expect(summarizeEvaluation(results)).toEqual({
      total: 3,
      passed: 2,
      failed: 1,
      passRate: 2 / 3,
    });

    const categories = groupResultsByCategory(results);
    expect(categories.duplicate).toMatchObject({
      total: 2,
      passed: 1,
      failed: 1,
      passRate: 0.5,
      caseIds: ["duplicate-pass", "duplicate-fail"],
      failedCaseIds: ["duplicate-fail"],
      means: {
        finalScore: 0.2,
        semanticNovelty: 0.25,
        lexicalNovelty: 0.35,
        relevance: 0.7,
        relevanceGate: 0.875,
      },
    });
    expect(categories.duplicate.means.rawNovelty).toBeCloseTo(0.3);
    expect(categories.novel_relevant.means.finalScore).toBe(0.7);
    expect(categories.borderline).toMatchObject({
      total: 0,
      passed: 0,
      failed: 0,
      passRate: null,
    });
    expect(categories.borderline.means.finalScore).toBeNull();
  });
});
