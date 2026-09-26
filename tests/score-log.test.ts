import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCsv, toCsvLine } from "../src/io/csv.js";
import {
  appendScoreLog,
  baselineFingerprint,
  SCORE_LOG_HEADER,
  type ScoreRunEntry,
  toScoreLogRow,
} from "../src/io/score-log.js";
import { parseBaselineUpload } from "../src/server/baseline-set.js";
import type { NoveltyScoreResult } from "../src/types/score.js";
import type { Submission } from "../src/types/submission.js";

describe("CSV helpers", () => {
  it("round-trips commas, quotes, and newlines", () => {
    const values = ["plain", "has, comma", 'has "quotes"', "multi\nline", ""];
    expect(parseCsv(`${toCsvLine(values)}\n`)).toEqual([values]);
  });

  it("handles CRLF, a BOM, and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('a,"b\n')).toThrow("unterminated");
  });
});

describe("baseline uploads", () => {
  it("reads CSV columns in any order and ignores extra columns", () => {
    expect(
      parseBaselineUpload(
        "csv",
        "Perspective,Body,Notes,Headline,ID\nsupport,Body text with enough words,ignored,Title,s1\n",
      ),
    ).toEqual([{ id: "s1", headline: "Title", body: "Body text with enough words", perspective: "support" }]);
  });

  it("reports invalid uploads", () => {
    expect(() => parseBaselineUpload("json", "{")).toThrow("not valid JSON");
    expect(() => parseBaselineUpload("json", "{}")).toThrow("array");
    expect(() => parseBaselineUpload("json", "[]")).toThrow("At least one");
    expect(() => parseBaselineUpload("csv", "id,headline,body\n")).toThrow("missing: perspective");
    expect(() =>
      parseBaselineUpload("csv", "id,headline,body,perspective\nx,h,Body text with enough words,rant\n"),
    ).toThrow("perspective");
  });
});

describe("score log", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  const baselines: Submission[] = [
    { id: "b1", headline: "One", body: "First, body", perspective: "support" },
  ];
  const result = {
    finalScore: 0.5,
    rawNovelty: 0.6,
    semantic: { novelty: 0.55 },
    lexical: { novelty: 0.7 },
    relevance: { similarity: 0.3, gate: 0.8 },
    nearestNeighbors: [
      { rank: 1, submissionId: "b1", semanticSimilarity: 0.45, lexicalSimilarity: 0.2 },
    ],
  } as NoveltyScoreResult;
  const entry: ScoreRunEntry = {
    source: "cli",
    candidate: { id: "c1", headline: "Head, line", body: 'Says "hi"', perspective: "question" },
    result,
    baselines,
    timestamp: new Date("2026-09-26T00:00:00.000Z"),
  };

  it("writes the header once and appends one row per run", async () => {
    directory = await mkdtemp(join(tmpdir(), "score-log-"));
    const filePath = join(directory, "nested", "runs.csv");

    await Promise.all([appendScoreLog(entry, filePath), appendScoreLog(entry, filePath)]);

    const rows = parseCsv(await readFile(filePath, "utf8"));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(SCORE_LOG_HEADER);

    const row = Object.fromEntries(SCORE_LOG_HEADER.map((name, index) => [name, rows[1][index]]));
    expect(row).toMatchObject({
      timestamp: "2026-09-26T00:00:00.000Z",
      source: "cli",
      candidateId: "c1",
      headline: "Head, line",
      body: 'Says "hi"',
      finalScore: "0.5",
      relevanceGate: "0.8",
      baselineCount: "1",
      baselineFingerprint: baselineFingerprint(baselines),
      neighbor1Id: "b1",
      neighbor1Semantic: "0.45",
      neighbor2Id: "",
    });
  });

  it("neutralizes spreadsheet formulas in text cells", () => {
    const row = toScoreLogRow({
      ...entry,
      candidate: {
        id: "@id",
        headline: '=HYPERLINK("http://example.test")',
        body: "+cmd|' /C calc'!A0",
        perspective: "question",
      },
    });
    const candidateColumn = SCORE_LOG_HEADER.indexOf("candidateId");
    expect(row.slice(candidateColumn, candidateColumn + 3)).toEqual([
      "'@id",
      `'=HYPERLINK("http://example.test")`,
      "'+cmd|' /C calc'!A0",
    ]);
    expect(toScoreLogRow(entry)[candidateColumn + 1]).toBe("Head, line");
  });

  const column = (row: readonly unknown[], name: string): unknown =>
    row[SCORE_LOG_HEADER.indexOf(name)];

  it("rounds scores to four decimals", () => {
    const row = toScoreLogRow({
      ...entry,
      result: {
        ...result,
        finalScore: 0.123456789,
        nearestNeighbors: [{ ...result.nearestNeighbors[0], semanticSimilarity: 0.98765 }],
      } as NoveltyScoreResult,
    });
    expect(column(row, "finalScore")).toBe(0.1235);
    expect(column(row, "neighbor1Semantic")).toBe(0.9877);
  });

  it("records the case, category, and PASS/FAIL for labeled cases", () => {
    const checks = [
      { expectation: "minFinalScore", metric: "finalScore", operator: "min", expected: 0.15, actual: 0.3, passed: true },
      { expectation: "minRelevance", metric: "relevance", operator: "min", expected: 0.35, actual: 0.26104, passed: false },
    ] as const;
    const row = toScoreLogRow({
      ...entry,
      evaluation: { caseId: "eval-1", category: "novel_relevant", passed: false, checks },
    });

    expect(column(row, "evaluationCaseId")).toBe("eval-1");
    expect(column(row, "category")).toBe("novel_relevant");
    expect(column(row, "result")).toBe("FAIL");
    expect(column(row, "expectedBounds")).toBe("finalScore >= 0.150; relevance >= 0.350");
    expect(column(row, "failedChecks")).toBe("relevance 0.2610 (expected >= 0.350)");
    expect(column(toScoreLogRow(entry), "result")).toBeUndefined();
  });

  it("refuses to append under an older header", async () => {
    directory = await mkdtemp(join(tmpdir(), "score-log-"));
    const filePath = join(directory, "runs.csv");
    await writeFile(filePath, "timestamp,source,candidateId\n", "utf8");

    await expect(appendScoreLog(entry, filePath)).rejects.toThrow("older column layout");
  });

  it("fingerprints change when the baseline set changes", () => {
    expect(baselineFingerprint(baselines)).toBe(baselineFingerprint([...baselines]));
    expect(baselineFingerprint(baselines)).not.toBe(
      baselineFingerprint([{ ...baselines[0], body: "Edited" }]),
    );
  });
});
