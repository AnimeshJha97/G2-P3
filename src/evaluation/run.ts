import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { LocalEmbeddingProvider } from "../embeddings/local-embedding-provider.js";
import { NoveltyScorer } from "../scoring/novelty-scorer.js";
import { fixedContentSchema } from "../types/fixed-content.js";
import {
  EVALUATION_CATEGORIES,
  labeledEvaluationCasesSchema,
  type EvaluationReport,
  type LabeledEvaluationCase,
} from "../types/evaluation.js";
import { submissionSchema, type Submission } from "../types/submission.js";
import { EVALUATION_SCORING_CONFIG } from "./config.js";
import {
  groupResultsByCategory,
  scoreEvaluationCases,
  summarizeEvaluation,
} from "./evaluator.js";
import { renderEvaluationMarkdown } from "./markdown.js";

const projectFile = (relativePath: string): URL =>
  new URL(`../../${relativePath}`, import.meta.url);

const loadJson = async (relativePath: string): Promise<unknown> =>
  JSON.parse(await readFile(projectFile(relativePath), "utf8"));

const assertEvaluationIdsAreSeparate = (
  baselines: readonly Submission[],
  cases: readonly LabeledEvaluationCase[],
): void => {
  const baselineIds = new Set(baselines.map(({ id }) => id));
  const leakedIds = cases
    .map(({ candidate }) => candidate.id)
    .filter((id) => baselineIds.has(id));

  if (leakedIds.length > 0) {
    throw new Error(
      `Evaluation candidate IDs must not appear in the baseline: ${leakedIds.join(", ")}`,
    );
  }
};

const printSummary = (report: EvaluationReport): void => {
  console.log(
    `Evaluation: ${report.summary.passed}/${report.summary.total} passed (${(
      report.summary.passRate * 100
    ).toFixed(1)}%)`,
  );

  console.table(
    EVALUATION_CATEGORIES.map((category) => {
      const result = report.categories[category];
      return {
        category,
        passed: `${result.passed}/${result.total}`,
        meanFinal: result.means.finalScore?.toFixed(3) ?? "n/a",
        meanRawNovelty: result.means.rawNovelty?.toFixed(3) ?? "n/a",
        meanRelevance: result.means.relevance?.toFixed(3) ?? "n/a",
      };
    }),
  );

  if (report.failedCases.length > 0) {
    console.log(
      `Failed cases: ${report.failedCases.map(({ id }) => id).join(", ")}`,
    );
  }
};

export const runEvaluation = async (): Promise<EvaluationReport> => {
  const startedAt = performance.now();
  const [fixedContentJson, baselineJson, casesJson] = await Promise.all([
    loadJson("data/fixed-content.json"),
    loadJson("data/submissions.json"),
    loadJson("data/labeled-cases.json"),
  ]);

  const fixedContent = fixedContentSchema.parse(fixedContentJson);
  const baselines = submissionSchema.array().min(1).parse(baselineJson);
  const cases = labeledEvaluationCasesSchema.parse(casesJson);
  assertEvaluationIdsAreSeparate(baselines, cases);

  const embeddingProvider = new LocalEmbeddingProvider();
  const scorer = new NoveltyScorer(
    embeddingProvider,
    EVALUATION_SCORING_CONFIG,
  );
  const prepared = await scorer.prepare(fixedContent, baselines);
  const caseResults = await scoreEvaluationCases(cases, (candidate) =>
    scorer.score(candidate, prepared),
  );
  const summary = summarizeEvaluation(caseResults);

  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
    embeddingModel: embeddingProvider.modelId,
    config: EVALUATION_SCORING_CONFIG,
    baselineCount: baselines.length,
    evaluationCount: cases.length,
    summary,
    categories: groupResultsByCategory(caseResults),
    failedCases: caseResults.filter(({ passed }) => !passed),
    cases: caseResults,
  };

  const outputUrl = projectFile("evaluation/results.json");
  await mkdir(new URL("./", outputUrl), { recursive: true });
  await Promise.all([
    writeFile(outputUrl, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(
      projectFile("evaluation/results.md"),
      renderEvaluationMarkdown(report, baselines),
      "utf8",
    ),
  ]);
  printSummary(report);

  return report;
};

const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  await runEvaluation();
}
