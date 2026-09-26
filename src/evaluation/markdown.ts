import type {
  EvaluationCaseResult,
  EvaluationCategory,
  EvaluationReport,
} from "../types/evaluation.js";
import type { Submission } from "../types/submission.js";

export const DEMO_CASE_IDS = {
  paraphrase: "eval-paraphrase-004",
  novelRelevant: "eval-novel-relevant-002",
  novelIrrelevant: "eval-novel-irrelevant-002",
} as const;

const CATEGORY_LABELS: Record<EvaluationCategory, string> = {
  duplicate: "Duplicate",
  near_duplicate: "Near duplicate",
  paraphrase: "Paraphrase",
  common: "Common",
  novel_relevant: "Novel + relevant",
  novel_irrelevant: "Novel + irrelevant",
  borderline: "Borderline",
};

const DEMO_LABELS: Record<keyof typeof DEMO_CASE_IDS, string> = {
  paraphrase: "Semantic paraphrase",
  novelRelevant: "Novel + relevant",
  novelIrrelevant: "Novel + irrelevant",
};

const DEMO_REASONS: Record<keyof typeof DEMO_CASE_IDS, string> = {
  paraphrase:
    "Low token overlap is counterbalanced by the nearest multilingual-theme submissions, demonstrating why semantic comparison is needed.",
  novelRelevant:
    "A new conflict-detection idea remains clearly tied to extracted action items, so the relevance gate preserves its novelty reward.",
  novelIrrelevant:
    "The gardening idea is highly novel relative to the baseline, but source relevance falls below the low cutoff and the final reward is zero.",
};

const score = (value: number | null): string =>
  value === null ? "n/a" : value.toFixed(3);

const percent = (value: number | null): string =>
  value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;

const tableText = (value: string): string => value.replaceAll("|", "\\|");

const passMark = (passed: boolean): string => (passed ? "PASS" : "FAIL");

const findCase = (
  report: EvaluationReport,
  caseId: string,
): EvaluationCaseResult => {
  const result = report.cases.find(({ id }) => id === caseId);
  if (!result) {
    throw new Error(`Demo case not found in evaluation report: ${caseId}`);
  }

  return result;
};

const neighborRows = (
  result: EvaluationCaseResult,
  baselines: ReadonlyMap<string, Submission>,
): string[] =>
  result.score.nearestNeighbors.map((neighbor) => {
    const headline = baselines.get(neighbor.submissionId)?.headline ?? "Unknown";
    return `| ${neighbor.rank} | \`${neighbor.submissionId}\` | ${tableText(headline)} | ${score(neighbor.semanticSimilarity)} | ${score(neighbor.lexicalSimilarity)} | ${score(neighbor.semanticAggregationWeight)} | ${score(neighbor.semanticSimilarityContribution)} |`;
  });

const caseScoreTable = (result: EvaluationCaseResult): string[] => [
  "| Component | Value |",
  "|---|---:|",
  `| Semantic neighbor weight sum | ${score(result.score.semantic.weightSum)} |`,
  `| Semantic weighted similarity sum | ${score(result.score.semantic.weightedSimilaritySum)} |`,
  `| Semantic aggregated similarity | ${score(result.score.semantic.aggregatedSimilarity)} |`,
  `| Semantic novelty | ${score(result.score.semantic.novelty)} |`,
  `| Lexical max source | \`${result.score.lexical.mostSimilarSubmissionId}\` |`,
  `| Lexical max similarity | ${score(result.score.lexical.maxSimilarity)} |`,
  `| Lexical novelty | ${score(result.score.lexical.novelty)} |`,
  `| Semantic weighted contribution (${score(result.score.rawNoveltyComponents.semanticWeight)} weight) | ${score(result.score.rawNoveltyComponents.semanticContribution)} |`,
  `| Lexical weighted contribution (${score(result.score.rawNoveltyComponents.lexicalWeight)} weight) | ${score(result.score.rawNoveltyComponents.lexicalContribution)} |`,
  `| Raw novelty | ${score(result.score.rawNovelty)} |`,
  `| Relevance similarity | ${score(result.score.relevance.similarity)} |`,
  `| Relevance gate low / high | ${score(result.score.relevance.low)} / ${score(result.score.relevance.high)} |`,
  `| Relevance gate | ${score(result.score.relevance.gate)} |`,
  `| Final score | ${score(result.score.finalScore)} |`,
];

const neighborTable = (
  result: EvaluationCaseResult,
  baselines: ReadonlyMap<string, Submission>,
): string[] => [
  "| Rank | Submission | Headline | Semantic similarity | Lexical similarity | Aggregation weight | Semantic contribution |",
  "|---:|---|---|---:|---:|---:|---:|",
  ...neighborRows(result, baselines),
];

const failedCaseSection = (
  result: EvaluationCaseResult,
  baselines: ReadonlyMap<string, Submission>,
): string[] => [
  `### \`${result.id}\` — ${tableText(result.candidate.headline)}`,
  "",
  result.rationale,
  "",
  ...caseScoreTable(result),
  "",
  "Expectation checks:",
  "",
  "| Metric | Bound | Actual | Status |",
  "|---|---:|---:|---|",
  ...result.checks.map(
    (check) =>
      `| ${check.metric} | ${check.operator} ${score(check.expected)} | ${score(check.actual)} | ${passMark(check.passed)} |`,
  ),
  "",
  `Top-${result.score.semantic.topK} semantic neighbors:`,
  "",
  ...neighborTable(result, baselines),
  "",
];

const demoSection = (
  key: keyof typeof DEMO_CASE_IDS,
  result: EvaluationCaseResult,
  baselines: ReadonlyMap<string, Submission>,
): string[] => [
  `### ${DEMO_LABELS[key]} — \`${result.id}\``,
  "",
  `**Candidate:** ${result.candidate.headline} — ${result.candidate.body}`,
  "",
  `**Why selected:** ${DEMO_REASONS[key]}`,
  "",
  `**Evaluation status:** ${passMark(result.passed)}`,
  "",
  ...caseScoreTable(result),
  "",
  `Top-${result.score.semantic.topK} semantic neighbors:`,
  "",
  ...neighborTable(result, baselines),
  "",
];

export const renderEvaluationMarkdown = (
  report: EvaluationReport,
  baselineSubmissions: readonly Submission[],
): string => {
  const baselines = new Map(
    baselineSubmissions.map((submission) => [submission.id, submission]),
  );
  const novelRelevant = report.categories.novel_relevant.means.finalScore ?? 0;
  const duplicate = report.categories.duplicate.means.finalScore ?? 0;
  const paraphrase = report.categories.paraphrase.means.finalScore ?? 0;
  const common = report.categories.common.means.finalScore ?? 0;
  const novelIrrelevant = report.categories.novel_irrelevant.means;
  const scoresInRange = report.cases.every(
    ({ score: result }) => result.finalScore >= 0 && result.finalScore <= 1,
  );
  const demos = Object.entries(DEMO_CASE_IDS) as Array<
    [keyof typeof DEMO_CASE_IDS, string]
  >;

  const lines = [
    "# Evaluation Results",
    "",
    `Generated from the locked evaluation run at ${report.generatedAt}. Numeric values are shown to three decimal places; machine-precision values remain in \`evaluation/results.json\`.`,
    "",
    "## Executive summary",
    "",
    `The locked configuration passes **${report.summary.passed}/${report.summary.total} cases (${percent(report.summary.passRate)})**. ${report.failedCases.length} labeled novel-relevant cases remain failed because their raw source-relevance similarity is below the required 0.350. They are reported in full below.`,
    "",
    "The central guardrail works on this dataset: novel-but-irrelevant submissions have high mean raw novelty but a zero mean final score after relevance gating.",
    "",
    "## Locked configuration",
    "",
    `- Embedding model: \`${report.embeddingModel}\``,
    `- Top-K semantic neighbors: ${report.config.topK}`,
    `- Semantic neighbor weights: ${report.config.semanticNeighborWeights.map((value) => value.toFixed(2)).join(" / ")}`,
    `- Semantic / lexical novelty weights: ${report.config.semanticWeight.toFixed(2)} / ${report.config.lexicalWeight.toFixed(2)}`,
    `- Relevance low / high: ${report.config.relevanceLow.toFixed(2)} / ${report.config.relevanceHigh.toFixed(2)}`,
    "",
    "No scoring parameter was changed for this report.",
    "",
    "## Dataset",
    "",
    `- Baseline submissions: ${report.baselineCount}`,
    `- Labeled evaluation cases: ${report.evaluationCount}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    "",
    "## Category results",
    "",
    "| Category | Passed | Pass rate | Mean final | Mean raw novelty | Mean semantic novelty | Mean lexical novelty | Mean relevance | Mean gate |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...Object.values(report.categories).map(
      (category) =>
        `| ${CATEGORY_LABELS[category.category]} | ${category.passed}/${category.total} | ${percent(category.passRate)} | ${score(category.means.finalScore)} | ${score(category.means.rawNovelty)} | ${score(category.means.semanticNovelty)} | ${score(category.means.lexicalNovelty)} | ${score(category.means.relevance)} | ${score(category.means.relevanceGate)} |`,
    ),
    "",
    "## Separation and guardrails",
    "",
    "| Check | Actual | Status |",
    "|---|---:|---|",
    `| Labeled-case pass rate >= 85% | ${percent(report.summary.passRate)} | ${passMark(report.summary.passRate >= 0.85)} |`,
    `| Novel-relevant mean final > duplicate | ${score(novelRelevant - duplicate)} margin | ${passMark(novelRelevant > duplicate)} |`,
    `| Novel-relevant mean final > common | ${score(novelRelevant - common)} margin | ${passMark(novelRelevant > common)} |`,
    `| Novel-relevant mean final > paraphrase | ${score(novelRelevant - paraphrase)} margin | ${passMark(novelRelevant > paraphrase)} |`,
    `| Novel-irrelevant mean final = 0 | ${score(novelIrrelevant.finalScore)} | ${passMark(novelIrrelevant.finalScore === 0)} |`,
    `| Novel-irrelevant raw novelty remains high | ${score(novelIrrelevant.rawNovelty)} | ${passMark((novelIrrelevant.rawNovelty ?? 0) >= 0.75)} |`,
    `| All final scores within [0, 1] | ${scoresInRange ? "100%" : "<100%"} | ${passMark(scoresInRange)} |`,
    "",
    "The novel-relevant mean is 0.026 below the paraphrase mean. This failed separation check is retained as a model/representation limitation, not relabeled or tuned away.",
    "",
    "## Failed cases",
    "",
    `All ${report.failedCases.length} failed cases are included. Each passes its final-score and raw-novelty bounds but fails the labeled minimum relevance similarity of 0.350.`,
    "",
    ...report.failedCases.flatMap((result) =>
      failedCaseSection(result, baselines),
    ),
    "## Representative demo cases",
    "",
    "These fixed cases cover the three behaviors needed for the demo. Their explanations use only deterministic score components and stored baseline comparisons.",
    "",
    ...demos.flatMap(([key, caseId]) =>
      demoSection(key, findCase(report, caseId), baselines),
    ),
    "## Explainability contract",
    "",
    "`NoveltyScoreResult` exposes the complete deterministic calculation path:",
    "",
    "1. Ranked Top-K neighbors with semantic and lexical similarity, normalized aggregation weight, and semantic contribution.",
    "2. Weighted semantic-similarity sum, weight sum, aggregated similarity, and semantic novelty.",
    "3. Maximum lexical similarity, its source submission, and lexical novelty.",
    "4. Semantic and lexical weights and their contributions to raw novelty.",
    "5. Relevance similarity, low/high gate bounds, and the resulting gate.",
    "6. Raw novelty and final score.",
    "",
    "The formulas are:",
    "",
    "```text",
    "semanticNovelty = 1 - weightedTopKSemanticSimilarity",
    "lexicalNovelty = 1 - maxLexicalSimilarity",
    "rawNovelty = 0.85 * semanticNovelty + 0.15 * lexicalNovelty",
    "finalScore = rawNovelty * relevanceGate",
    "```",
    "",
    "No generative model is called to create runtime score explanations.",
    "",
    "## Known limitations",
    "",
    "- Four of five novel-relevant cases miss the labeled raw-relevance threshold even though their raw novelty and final score checks pass.",
    "- Novel-relevant versus paraphrase mean final-score separation is reversed by 0.026 because the novel-relevant group receives lower average source relevance.",
    "- A single embedding can lose detail in multi-topic submissions and can understate relevance for product-specific edge cases.",
    "- Thresholds are calibrated to this model and dataset; synthetic cases and 50 baselines do not establish production-scale validity.",
    "- Novelty remains relative to baseline coverage, and token Jaccard is language- and wording-dependent.",
    "",
    "## Reproduce",
    "",
    "```bash",
    "npm run evaluate",
    "```",
    "",
    "This rewrites both `evaluation/results.json` and this Markdown report from the same evaluation run.",
    "",
  ];

  return `${lines.join("\n")}\n`;
};
