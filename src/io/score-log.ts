import { createHash } from "node:crypto";
import { appendFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { NoveltyScoreResult } from "../types/score.js";
import type { Submission } from "../types/submission.js";
import { toCsvLine, type CsvValue } from "./csv.js";

export type ScoreRunSource = "cli" | "ui";

export interface ScoreRunEntry {
  source: ScoreRunSource;
  candidate: Submission;
  result: NoveltyScoreResult;
  baselines: readonly Submission[];
  timestamp?: Date;
}

export const DEFAULT_SCORE_LOG_PATH = resolve("logs/score-runs.csv");

const NEIGHBOR_COLUMNS = 3;

export const SCORE_LOG_HEADER: readonly string[] = [
  "timestamp",
  "source",
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

export const toScoreLogRow = ({
  source,
  candidate,
  result,
  baselines,
  timestamp = new Date(),
}: ScoreRunEntry): CsvValue[] => [
  timestamp.toISOString(),
  source,
  asSpreadsheetText(candidate.id),
  asSpreadsheetText(candidate.headline),
  asSpreadsheetText(candidate.body),
  candidate.perspective,
  result.finalScore,
  result.rawNovelty,
  result.semantic.novelty,
  result.lexical.novelty,
  result.relevance.similarity,
  result.relevance.gate,
  baselines.length,
  baselineFingerprint(baselines),
  ...Array.from({ length: NEIGHBOR_COLUMNS }, (_, index) => {
    const neighbor = result.nearestNeighbors[index];
    return [
      asSpreadsheetText(neighbor?.submissionId),
      neighbor?.semanticSimilarity,
      neighbor?.lexicalSimilarity,
    ];
  }).flat(),
];

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
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
    const header = (await fileExists(filePath))
      ? ""
      : `${toCsvLine(SCORE_LOG_HEADER)}\n`;
    await appendFile(filePath, `${header}${toCsvLine(toScoreLogRow(entry))}\n`, "utf8");
  };

  pendingWrite = pendingWrite.then(write, write);
  return pendingWrite;
};
