import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
  EvaluationCategory,
  ExpectationCheck,
} from "../types/evaluation.js";
import type { NoveltyScoreResult } from "../types/score.js";
import type { Submission } from "../types/submission.js";
import { toCsvLine, type CsvValue } from "./csv.js";

export type ScoreRunSource = "cli" | "ui";

// Present when the run scored a labeled golden-dataset case.
export interface ScoreRunEvaluation {
  caseId: string;
  category: EvaluationCategory;
  passed: boolean;
  checks: readonly ExpectationCheck[];
}

export interface ScoreRunEntry {
  source: ScoreRunSource;
  candidate: Submission;
  result: NoveltyScoreResult;
  baselines: readonly Submission[];
  evaluation?: ScoreRunEvaluation;
  timestamp?: Date;
}

export const DEFAULT_SCORE_LOG_PATH = resolve("logs/score-runs.csv");

const NEIGHBOR_COLUMNS = 3;

// Scores are logged at 4 decimals for readability. PASS/FAIL is decided on
// full precision, and evaluation/results.json keeps machine precision.
export const SCORE_LOG_DECIMALS = 4;

const round = (value: number | undefined): number | undefined =>
  value === undefined ? undefined : Number(value.toFixed(SCORE_LOG_DECIMALS));

export const SCORE_LOG_HEADER: readonly string[] = [
  "timestamp",
  "source",
  "evaluationCaseId",
  "category",
  "result",
  "expectedBounds",
  "failedChecks",
  "candidateId",
  "headline",
  "body",
  "perspective",
  "finalScore",
  "rawNovelty",
  "semanticNovelty",
  "lexicalNovelty",
  "relevanceSimilarity",
  "relevanceGate",
  "baselineCount",
  "baselineFingerprint",
  ...Array.from({ length: NEIGHBOR_COLUMNS }, (_, index) => [
    `neighbor${index + 1}Id`,
    `neighbor${index + 1}Semantic`,
    `neighbor${index + 1}Lexical`,
  ]).flat(),
];

// Identifies the exact baseline set a run was scored against, so runs made
// after baselines were edited in the UI are distinguishable in the log.
export const baselineFingerprint = (baselines: readonly Submission[]): string =>
  createHash("sha256")
    .update(
      JSON.stringify(
        baselines.map(({ id, headline, body, perspective }) => [
          id,
          headline,
          body,
          perspective,
        ]),
      ),
    )
    .digest("hex")
    .slice(0, 12);

// Spreadsheet apps execute cells starting with these characters as formulas;
// a leading apostrophe makes them display as plain text.
const asSpreadsheetText = (value: string | undefined): string | undefined =>
  value !== undefined && /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value;

const comparison = ({ operator }: ExpectationCheck): string =>
  operator === "min" ? ">=" : "<=";

const formatBound = (check: ExpectationCheck): string =>
  `${check.metric} ${comparison(check)} ${check.expected.toFixed(3)}`;

const formatFailedCheck = (check: ExpectationCheck): string =>
  `${check.metric} ${check.actual.toFixed(SCORE_LOG_DECIMALS)} (expected ${comparison(check)} ${check.expected.toFixed(3)})`;

// UI and free-form CLI runs have no labeled expectation, so these stay empty.
const evaluationColumns = (evaluation: ScoreRunEvaluation | undefined): CsvValue[] =>
  evaluation
    ? [
        evaluation.caseId,
        evaluation.category,
        evaluation.passed ? "PASS" : "FAIL",
        evaluation.checks.map(formatBound).join("; "),
        evaluation.checks
          .filter(({ passed }) => !passed)
          .map(formatFailedCheck)
          .join("; "),
      ]
    : [undefined, undefined, undefined, undefined, undefined];

export const toScoreLogRow = ({
  source,
  candidate,
  result,
  baselines,
  evaluation,
  timestamp = new Date(),
}: ScoreRunEntry): CsvValue[] => [
  timestamp.toISOString(),
  source,
  ...evaluationColumns(evaluation),
  asSpreadsheetText(candidate.id),
  asSpreadsheetText(candidate.headline),
  asSpreadsheetText(candidate.body),
  candidate.perspective,
  round(result.finalScore),
  round(result.rawNovelty),
  round(result.semantic.novelty),
  round(result.lexical.novelty),
  round(result.relevance.similarity),
  round(result.relevance.gate),
  baselines.length,
  baselineFingerprint(baselines),
  ...Array.from({ length: NEIGHBOR_COLUMNS }, (_, index) => {
    const neighbor = result.nearestNeighbors[index];
    return [
      asSpreadsheetText(neighbor?.submissionId),
      round(neighbor?.semanticSimilarity),
      round(neighbor?.lexicalSimilarity),
    ];
  }).flat(),
];

const HEADER_LINE = toCsvLine(SCORE_LOG_HEADER);

// Returns the existing file's first line, or undefined if the file is missing or empty.
const readHeaderLine = async (filePath: string): Promise<string | undefined> => {
  try {
    return (await readFile(filePath, "utf8")).split(/\r?\n/u, 1)[0] || undefined;
  } catch {
    return undefined;
  }
};

// Serializes appends so concurrent runs cannot interleave or double-write the header.
let pendingWrite: Promise<void> = Promise.resolve();

export const appendScoreLog = (
  entry: ScoreRunEntry,
  filePath: string = DEFAULT_SCORE_LOG_PATH,
): Promise<void> => {
  const write = async (): Promise<void> => {
    await mkdir(dirname(filePath), { recursive: true });
    const existingHeader = await readHeaderLine(filePath);
    // Appending under a different header would misalign every new row.
    if (existingHeader !== undefined && existingHeader !== HEADER_LINE) {
      throw new Error(
        `${filePath} uses an older column layout; move or delete it to start a new log`,
      );
    }
    const header = existingHeader === undefined ? `${HEADER_LINE}\n` : "";
    await appendFile(filePath, `${header}${toCsvLine(toScoreLogRow(entry))}\n`, "utf8");
  };

  pendingWrite = pendingWrite.then(write, write);
  return pendingWrite;
};
