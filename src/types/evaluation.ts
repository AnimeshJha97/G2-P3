import { z } from "zod";

import type { NoveltyScoreResult, ScoringConfig } from "./score.js";
import type { Submission } from "./submission.js";
import { submissionSchema } from "./submission.js";

export const EVALUATION_CATEGORIES = [
  "duplicate",
  "near_duplicate",
  "paraphrase",
  "common",
  "novel_relevant",
  "novel_irrelevant",
  "borderline",
] as const;

export type EvaluationCategory = (typeof EVALUATION_CATEGORIES)[number];

export interface EvaluationExpectation {
  minFinalScore?: number;
  maxFinalScore?: number;
  minRawNovelty?: number;
  maxRawNovelty?: number;
  minRelevance?: number;
  maxRelevance?: number;
}

export interface LabeledEvaluationCase {
  id: string;
  category: EvaluationCategory;
  candidate: Submission;
  expectation: EvaluationExpectation;
  rationale: string;
}

export type EvaluationMetric =
  | "finalScore"
  | "rawNovelty"
  | "semanticNovelty"
  | "lexicalNovelty"
  | "relevance"
  | "relevanceGate";

export interface ExpectationCheck {
  expectation: keyof EvaluationExpectation;
  metric: "finalScore" | "rawNovelty" | "relevance";
  operator: "min" | "max";
  expected: number;
  actual: number;
  passed: boolean;
}

export interface EvaluationCaseResult extends LabeledEvaluationCase {
  score: NoveltyScoreResult;
  passed: boolean;
  checks: ExpectationCheck[];
}

export type MetricMeans = Record<EvaluationMetric, number | null>;

export interface CategoryEvaluationResult {
  category: EvaluationCategory;
  total: number;
  passed: number;
  failed: number;
  passRate: number | null;
  means: MetricMeans;
  caseIds: string[];
  failedCaseIds: string[];
}

export interface EvaluationSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
}

export interface EvaluationReport {
  generatedAt: string;
  durationMs: number;
  embeddingModel: string;
  config: ScoringConfig;
  baselineCount: number;
  evaluationCount: number;
  summary: EvaluationSummary;
  categories: Record<EvaluationCategory, CategoryEvaluationResult>;
  failedCases: EvaluationCaseResult[];
  cases: EvaluationCaseResult[];
}

const boundedScoreSchema = z.number().finite().min(0).max(1);

export const evaluationExpectationSchema = z
  .object({
    minFinalScore: boundedScoreSchema.optional(),
    maxFinalScore: boundedScoreSchema.optional(),
    minRawNovelty: boundedScoreSchema.optional(),
    maxRawNovelty: boundedScoreSchema.optional(),
    minRelevance: boundedScoreSchema.optional(),
    maxRelevance: boundedScoreSchema.optional(),
  })
  .strict()
  .superRefine((expectation, context) => {
    const ranges = [
      ["FinalScore", expectation.minFinalScore, expectation.maxFinalScore],
      ["RawNovelty", expectation.minRawNovelty, expectation.maxRawNovelty],
      ["Relevance", expectation.minRelevance, expectation.maxRelevance],
    ] as const;

    for (const [name, minimum, maximum] of ranges) {
      if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        context.addIssue({
          code: "custom",
          message: `min${name} must not exceed max${name}`,
        });
      }
    }
  });

export const labeledEvaluationCaseSchema: z.ZodType<LabeledEvaluationCase> = z
  .object({
    id: z.string().trim().min(1, "Evaluation case ID is required"),
    category: z.enum(EVALUATION_CATEGORIES),
    candidate: submissionSchema,
    expectation: evaluationExpectationSchema,
    rationale: z.string().trim().min(1, "Evaluation rationale is required"),
  })
  .strict();

export const labeledEvaluationCasesSchema = z
  .array(labeledEvaluationCaseSchema)
  .min(1, "At least one labeled evaluation case is required")
  .superRefine((cases, context) => {
    const caseIds = new Set<string>();
    const candidateIds = new Set<string>();

    cases.forEach((evaluationCase, index) => {
      if (caseIds.has(evaluationCase.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `Duplicate evaluation case ID: ${evaluationCase.id}`,
        });
      }
      caseIds.add(evaluationCase.id);

      if (candidateIds.has(evaluationCase.candidate.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "candidate", "id"],
          message: `Duplicate evaluation candidate ID: ${evaluationCase.candidate.id}`,
        });
      }
      candidateIds.add(evaluationCase.candidate.id);
    });
  });
