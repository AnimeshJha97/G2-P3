import { describe, expect, it } from "vitest";

import {
  formatScoreResult,
  parseScoreArguments,
} from "../src/cli/score.js";
import type { NoveltyScoreResult } from "../src/types/score.js";
import type { Submission } from "../src/types/submission.js";

describe("score CLI arguments", () => {
  it("accepts each supported structured candidate source", () => {
    expect(parseScoreArguments(["--json", "{}"])).toEqual({
      kind: "json",
      value: "{}",
    });
    expect(parseScoreArguments(["--file", "candidate.json"])).toEqual({
      kind: "file",
      value: "candidate.json",
    });
    expect(parseScoreArguments(["--case", "eval-paraphrase-004"])).toEqual({
      kind: "case",
      value: "eval-paraphrase-004",
    });
  });

  it("rejects missing, conflicting, and unexpected arguments", () => {
    expect(() => parseScoreArguments([])).toThrow("Provide exactly one");
    expect(() => parseScoreArguments(["--json"])).toThrow(
      "--json requires a value",
    );
    expect(() =>
      parseScoreArguments(["--json", "{}", "--file", "candidate.json"]),
    ).toThrow("Provide exactly one");
    expect(() => parseScoreArguments(["--file", "one.json", "extra"])).toThrow(
      "Unexpected command-line arguments",
    );
  });
});

describe("score CLI output", () => {
  it("prints requested score components and nearest submissions", () => {
    const candidate: Submission = {
      id: "candidate-001",
      headline: "A candidate",
      body: "Candidate body",
      perspective: "suggestion",
    };
    const baseline: Submission = {
      id: "submission-001",
      headline: "A neighbor",
      body: "Neighbor body",
      perspective: "support",
    };
    const score: NoveltyScoreResult = {
      finalScore: 0.4,
      rawNovelty: 0.5,
      semantic: {
        topK: 1,
        weightSum: 1,
        weightedSimilaritySum: 0.6,
        aggregatedSimilarity: 0.6,
        novelty: 0.4,
      },
      lexical: {
        mostSimilarSubmissionId: baseline.id,
        maxSimilarity: 0.2,
        novelty: 0.8,
      },
      rawNoveltyComponents: {
        semanticWeight: 0.85,
        semanticContribution: 0.34,
        lexicalWeight: 0.15,
        lexicalContribution: 0.12,
      },
      relevance: { similarity: 0.3, low: 0.1, high: 0.35, gate: 0.8 },
      nearestNeighbors: [
        {
          rank: 1,
          submissionId: baseline.id,
          semanticSimilarity: 0.6,
          lexicalSimilarity: 0.2,
          semanticAggregationWeight: 0.75,
          semanticSimilarityContribution: 0.45,
        },
        {
          rank: 2,
          submissionId: "announcement-001",
          semanticSimilarity: 0.4,
          lexicalSimilarity: 0.1,
          semanticAggregationWeight: 0.25,
          semanticSimilarityContribution: 0.1,
        },
      ],
    };

    const output = formatScoreResult(candidate, score, [baseline], {
      id: "announcement-001",
      title: "Assist AI launch",
      body: "Source announcement.",
    });

    for (const label of [
      "finalScore",
      "rawNovelty",
      "semanticNovelty",
      "lexicalNovelty",
      "relevance",
      "relevanceGate",
      "Top-2 nearest submissions",
      "submission-001 - A neighbor",
      "announcement-001 - Fixed content: Assist AI launch",
    ]) {
      expect(output).toContain(label);
    }
  });
});
