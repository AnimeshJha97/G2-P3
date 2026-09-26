import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ZodError, type ZodType } from "zod";

import { LocalEmbeddingProvider } from "../embeddings/local-embedding-provider.js";
import { DEMO_CASE_IDS } from "../evaluation/markdown.js";
import { EVALUATION_SCORING_CONFIG } from "../evaluation/config.js";
import { appendScoreLog, DEFAULT_SCORE_LOG_PATH } from "../io/score-log.js";
import { neighborHeadlines, NoveltyScorer } from "../scoring/novelty-scorer.js";
import {
  fixedContentSchema,
  type FixedContent,
} from "../types/fixed-content.js";
import { evaluateScoredCase } from "../evaluation/evaluator.js";
import {
  labeledEvaluationCasesSchema,
  type LabeledEvaluationCase,
} from "../types/evaluation.js";
import type { NoveltyScoreResult } from "../types/score.js";
import { submissionSchema, type Submission } from "../types/submission.js";

type CandidateSource =
  | { kind: "json"; value: string }
  | { kind: "file"; value: string }
  | { kind: "case"; value: string };

export const SCORE_USAGE = `Usage:
  npm run score -- --json '<candidate-json>'
  npm run score -- --file <candidate.json>
  npm run score -- --case <evaluation-case-id>

Candidate shape:
  {"id":"candidate-001","headline":"...","body":"...","perspective":"suggestion"}

Selected demo case IDs:
  ${Object.values(DEMO_CASE_IDS).join("\n  ")}`;

export const parseScoreArguments = (args: readonly string[]): CandidateSource => {
  if (args.includes("--help") || args.includes("-h")) {
    throw new Error(SCORE_USAGE);
  }

  const options = ["--json", "--file", "--case"] as const;
  const selected = options.filter((option) => args.includes(option));

  if (selected.length !== 1) {
    throw new Error(`Provide exactly one of --json, --file, or --case.\n\n${SCORE_USAGE}`);
  }

  const option = selected[0];
  const index = args.indexOf(option);
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.\n\n${SCORE_USAGE}`);
  }

  if (args.length !== 2) {
    throw new Error(`Unexpected command-line arguments.\n\n${SCORE_USAGE}`);
  }

  return {
    kind: option.slice(2) as CandidateSource["kind"],
    value,
  };
};

const parseJson = (text: string, label: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`${label} is not valid JSON${detail}`);
  }
};

export const readJsonFile = async (filePath: string, label: string): Promise<unknown> => {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`Could not read ${label} at ${filePath}${detail}`);
  }

  return parseJson(text, label);
};

export const parseWithContext = <T>(
  schema: ZodType<T>,
  value: unknown,
  label: string,
): T => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (!(error instanceof ZodError)) {
      throw error;
    }

    const issues = error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "input";
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");
    throw new Error(`${label} failed validation:\n${issues}`);
  }
};

const projectFile = (relativePath: string): string => resolve(relativePath);

export const loadProjectData = async (): Promise<{
  fixedContent: FixedContent;
  baselines: Submission[];
}> => {
  const [fixedContentJson, baselinesJson] = await Promise.all([
    readJsonFile(projectFile("data/fixed-content.json"), "fixed-content data"),
    readJsonFile(projectFile("data/submissions.json"), "baseline data"),
  ]);

  return {
    fixedContent: parseWithContext(
      fixedContentSchema,
      fixedContentJson,
      "Fixed-content data",
    ),
    baselines: parseWithContext(
      submissionSchema.array().min(1),
      baselinesJson,
      "Baseline data",
    ),
  };
};

interface LoadedCandidate {
  candidate: Submission;
  // Set only for --case, so the run can be checked against its expectations.
  evaluationCase?: LabeledEvaluationCase;
}

const loadCandidate = async (source: CandidateSource): Promise<LoadedCandidate> => {
  if (source.kind === "json") {
    return {
      candidate: parseWithContext(
        submissionSchema,
        parseJson(source.value, "Candidate"),
        "Candidate",
      ),
    };
  }

  if (source.kind === "file") {
    const candidateJson = await readJsonFile(
      resolve(source.value),
      "candidate file",
    );
    return {
      candidate: parseWithContext(submissionSchema, candidateJson, "Candidate"),
    };
  }

  const casesJson = await readJsonFile(
    projectFile("data/labeled-cases.json"),
    "labeled-case data",
  );
  const cases = parseWithContext(
    labeledEvaluationCasesSchema,
    casesJson,
    "Labeled-case data",
  );
  const selectedCase = cases.find(({ id }) => id === source.value);

  if (!selectedCase) {
    throw new Error(`Evaluation case not found: ${source.value}`);
  }

  return { candidate: selectedCase.candidate, evaluationCase: selectedCase };
};

const formatNumber = (value: number): string => value.toFixed(6);

export const formatScoreResult = (
  candidate: Submission,
  result: NoveltyScoreResult,
  baselines: readonly Submission[],
  fixedContent: FixedContent,
): string => {
  const headlines = neighborHeadlines(baselines, fixedContent);
  const lines = [
    `Candidate: ${candidate.id} - ${candidate.headline}`,
    `finalScore: ${formatNumber(result.finalScore)}`,
    `rawNovelty: ${formatNumber(result.rawNovelty)}`,
    `semanticNovelty: ${formatNumber(result.semantic.novelty)}`,
    `lexicalNovelty: ${formatNumber(result.lexical.novelty)}`,
    `relevance: ${formatNumber(result.relevance.similarity)}`,
    `relevanceGate: ${formatNumber(result.relevance.gate)}`,
    "",
    `Top-${result.nearestNeighbors.length} nearest submissions:`,
  ];

  for (const neighbor of result.nearestNeighbors) {
    lines.push(
      `${neighbor.rank}. ${neighbor.submissionId} - ${headlines.get(neighbor.submissionId) ?? "Unknown submission"}`,
      `   semanticSimilarity: ${formatNumber(neighbor.semanticSimilarity)}; lexicalSimilarity: ${formatNumber(neighbor.lexicalSimilarity)}`,
    );
  }

  return lines.join("\n");
};

export const runScoreCli = async (args: readonly string[]): Promise<void> => {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(SCORE_USAGE);
    return;
  }

  const source = parseScoreArguments(args);
  const [{ candidate, evaluationCase }, projectData] = await Promise.all([
    loadCandidate(source),
    loadProjectData(),
  ]);

  const baselineIds = new Set(projectData.baselines.map(({ id }) => id));
  if (baselineIds.has(candidate.id)) {
    throw new Error(`Candidate ID must not match a baseline submission ID: ${candidate.id}`);
  }

  const scorer = new NoveltyScorer(
    new LocalEmbeddingProvider(),
    EVALUATION_SCORING_CONFIG,
  );
  const prepared = await scorer.prepare(
    projectData.fixedContent,
    projectData.baselines,
  );
  const result = await scorer.score(candidate, prepared);

  console.log(formatScoreResult(candidate, result, projectData.baselines, projectData.fixedContent));

  const evaluated = evaluationCase && evaluateScoredCase(evaluationCase, result);
  if (evaluated) {
    const failed = evaluated.checks.filter(({ passed }) => !passed);
    console.log(
      `\nEvaluation (${evaluated.category}): ${evaluated.passed ? "PASS" : "FAIL"}` +
        failed
          .map(({ metric, operator, expected, actual }) =>
            `\n  ${metric} ${formatNumber(actual)} ${operator === "min" ? "<" : ">"} ${operator} ${expected}`,
          )
          .join(""),
    );
  }

  try {
    await appendScoreLog({
      source: "cli",
      candidate,
      result,
      baselines: projectData.baselines,
      evaluation: evaluated && {
        caseId: evaluated.id,
        category: evaluated.category,
        passed: evaluated.passed,
        checks: evaluated.checks,
      },
    });
    console.log(`\nRun logged to ${relative(process.cwd(), DEFAULT_SCORE_LOG_PATH)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not log score run: ${message}`);
  }
};

const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  runScoreCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Score command failed: ${message}`);
    process.exitCode = 1;
  });
}
