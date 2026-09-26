import {
  EVALUATION_CATEGORIES,
  type CategoryEvaluationResult,
  type EvaluationCaseResult,
  type EvaluationCategory,
  type EvaluationExpectation,
  type EvaluationMetric,
  type EvaluationSummary,
  type ExpectationCheck,
  type LabeledEvaluationCase,
  type MetricMeans,
} from "../types/evaluation.js";
import type { NoveltyScoreResult } from "../types/score.js";

export type ScoreCandidate = (
  candidate: LabeledEvaluationCase["candidate"],
) => Promise<NoveltyScoreResult>;

interface ExpectationDefinition {
  expectation: keyof EvaluationExpectation;
  metric: ExpectationCheck["metric"];
  operator: ExpectationCheck["operator"];
  actual: (score: NoveltyScoreResult) => number;
}

const EXPECTATION_DEFINITIONS: readonly ExpectationDefinition[] = [
  {
    expectation: "minFinalScore",
    metric: "finalScore",
    operator: "min",
    actual: (score) => score.finalScore,
  },
  {
    expectation: "maxFinalScore",
    metric: "finalScore",
    operator: "max",
    actual: (score) => score.finalScore,
  },
  {
    expectation: "minRawNovelty",
    metric: "rawNovelty",
    operator: "min",
    actual: (score) => score.rawNovelty,
  },
  {
    expectation: "maxRawNovelty",
    metric: "rawNovelty",
    operator: "max",
    actual: (score) => score.rawNovelty,
  },
  {
    expectation: "minRelevance",
    metric: "relevance",
    operator: "min",
    actual: (score) => score.relevance.similarity,
  },
  {
    expectation: "maxRelevance",
    metric: "relevance",
    operator: "max",
    actual: (score) => score.relevance.similarity,
  },
];

const METRIC_READERS: Record<
  EvaluationMetric,
  (score: NoveltyScoreResult) => number
> = {
  finalScore: (score) => score.finalScore,
  rawNovelty: (score) => score.rawNovelty,
  semanticNovelty: (score) => score.semantic.novelty,
  lexicalNovelty: (score) => score.lexical.novelty,
  relevance: (score) => score.relevance.similarity,
  relevanceGate: (score) => score.relevance.gate,
};

const emptyMeans = (): MetricMeans => ({
  finalScore: null,
  rawNovelty: null,
  semanticNovelty: null,
  lexicalNovelty: null,
  relevance: null,
  relevanceGate: null,
});

export const checkExpectations = (
  expectation: EvaluationExpectation,
  score: NoveltyScoreResult,
): ExpectationCheck[] =>
  EXPECTATION_DEFINITIONS.flatMap((definition) => {
    const expected = expectation[definition.expectation];
    if (expected === undefined) {
      return [];
    }

    const actual = definition.actual(score);
    return [
      {
        expectation: definition.expectation,
        metric: definition.metric,
        operator: definition.operator,
        expected,
        actual,
        passed:
          definition.operator === "min"
            ? actual >= expected
            : actual <= expected,
      },
    ];
  });

export const evaluateScoredCase = (
  evaluationCase: LabeledEvaluationCase,
  score: NoveltyScoreResult,
): EvaluationCaseResult => {
  const checks = checkExpectations(evaluationCase.expectation, score);

  return {
    ...evaluationCase,
    score,
    passed: checks.every(({ passed }) => passed),
    checks,
  };
};

export const scoreEvaluationCases = async (
  cases: readonly LabeledEvaluationCase[],
  scoreCandidate: ScoreCandidate,
): Promise<EvaluationCaseResult[]> => {
  const results: EvaluationCaseResult[] = [];

  for (const evaluationCase of cases) {
    const score = await scoreCandidate(evaluationCase.candidate);
    results.push(evaluateScoredCase(evaluationCase, score));
  }

  return results;
};

export const summarizeEvaluation = (
  results: readonly EvaluationCaseResult[],
): EvaluationSummary => {
  const passed = results.filter((result) => result.passed).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length === 0 ? 0 : passed / results.length,
  };
};

const meanFor = (
  results: readonly EvaluationCaseResult[],
  metric: EvaluationMetric,
): number | null => {
  if (results.length === 0) {
    return null;
  }

  return (
    results.reduce(
      (total, result) => total + METRIC_READERS[metric](result.score),
      0,
    ) / results.length
  );
};

export const groupResultsByCategory = (
  results: readonly EvaluationCaseResult[],
): Record<EvaluationCategory, CategoryEvaluationResult> =>
  Object.fromEntries(
    EVALUATION_CATEGORIES.map((category) => {
      const categoryResults = results.filter(
        (result) => result.category === category,
      );
      const summary = summarizeEvaluation(categoryResults);
      const means = emptyMeans();

      for (const metric of Object.keys(means) as EvaluationMetric[]) {
        means[metric] = meanFor(categoryResults, metric);
      }

      return [
        category,
        {
          category,
          ...summary,
          passRate: categoryResults.length === 0 ? null : summary.passRate,
          means,
          caseIds: categoryResults.map(({ id }) => id),
          failedCaseIds: categoryResults
            .filter(({ passed }) => !passed)
            .map(({ id }) => id),
        },
      ];
    }),
  ) as Record<EvaluationCategory, CategoryEvaluationResult>;
