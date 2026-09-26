import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { LocalEmbeddingProvider } from "../src/embeddings/local-embedding-provider.js";
import { EVALUATION_SCORING_CONFIG } from "../src/evaluation/config.js";
import {
  groupResultsByCategory,
  scoreEvaluationCases,
  summarizeEvaluation,
} from "../src/evaluation/evaluator.js";
import { NoveltyScorer } from "../src/scoring/novelty-scorer.js";
import { labeledEvaluationCasesSchema } from "../src/types/evaluation.js";
import { fixedContentSchema } from "../src/types/fixed-content.js";
import { submissionSchema } from "../src/types/submission.js";

const loadJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

// The three required behaviors, checked on the golden dataset with the real
// embedding model and the locked configuration (not mock vectors).
describe("golden dataset with the real embedding model", () => {
  it(
    "rewards novel relevant ideas, not repeats, and not irrelevant novelty",
    async () => {
      const fixedContent = fixedContentSchema.parse(
        await loadJson("data/fixed-content.json"),
      );
      const baselines = submissionSchema
        .array()
        .parse(await loadJson("data/submissions.json"));
      const cases = labeledEvaluationCasesSchema.parse(
        await loadJson("data/labeled-cases.json"),
      );

      const scorer = new NoveltyScorer(
        new LocalEmbeddingProvider(),
        EVALUATION_SCORING_CONFIG,
      );
      const prepared = await scorer.prepare(fixedContent, baselines);
      const results = await scoreEvaluationCases(cases, (candidate) =>
        scorer.score(candidate, prepared),
      );
      const categories = groupResultsByCategory(results);
      const finals = (category: keyof typeof categories) =>
        results
          .filter((result) => result.category === category)
          .map(({ score }) => score.finalScore);
      const meanFinal = (category: keyof typeof categories) =>
        categories[category].means.finalScore ?? Number.NaN;

      expect(summarizeEvaluation(results).passRate).toBeGreaterThanOrEqual(0.85);
      expect(
        results.every(({ score }) => score.finalScore >= 0 && score.finalScore <= 1),
      ).toBe(true);

      // Novel + relevant is rewarded above every exact duplicate.
      expect(Math.min(...finals("novel_relevant"))).toBeGreaterThan(
        Math.max(...finals("duplicate")),
      );

      // Non-novel content is not rewarded highly.
      expect(Math.max(...finals("duplicate"))).toBeLessThan(0.15);
      expect(meanFinal("novel_relevant")).toBeGreaterThan(meanFinal("near_duplicate"));
      expect(meanFinal("novel_relevant")).toBeGreaterThan(meanFinal("common"));

      // Novel but irrelevant content is gated to zero despite high raw novelty.
      const irrelevant = results.filter(
        ({ category }) => category === "novel_irrelevant",
      );
      expect(irrelevant.every(({ score }) => score.finalScore === 0)).toBe(true);
      expect(irrelevant.every(({ score }) => score.rawNovelty > 0.7)).toBe(true);
    },
    300_000,
  );
});
