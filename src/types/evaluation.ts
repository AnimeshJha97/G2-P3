import type { Submission } from "./submission.js";

export type EvaluationCategory =
  | "duplicate"
  | "near_duplicate"
  | "paraphrase"
  | "common"
  | "novel_relevant"
  | "novel_irrelevant"
  | "borderline";

export interface LabeledEvaluationCase {
  id: string;
  category: EvaluationCategory;
  candidate: Submission;
  expectation: {
    minFinalScore?: number;
    maxFinalScore?: number;
    minRawNovelty?: number;
    maxRawNovelty?: number;
    minRelevance?: number;
    maxRelevance?: number;
  };
  rationale: string;
}
