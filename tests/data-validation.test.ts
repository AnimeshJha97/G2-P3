import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  EVALUATION_CATEGORIES,
  fixedContentSchema,
  labeledEvaluationCasesSchema,
  PERSPECTIVES,
  submissionSchema,
} from "../src/types/index.js";

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));

const fixedContent = loadJson("../data/fixed-content.json");
const submissions = loadJson("../data/submissions.json");
const labeledCases = loadJson("../data/labeled-cases.json");

const searchableText = (submission: {
  headline: string;
  body: string;
}): string => `${submission.headline} ${submission.body}`.toLowerCase();

describe("static scoring data", () => {
  it("contains valid fixed content within the 100-word limit", () => {
    const parsed = fixedContentSchema.parse(fixedContent);
    const wordCount = parsed.body.trim().split(/\s+/u).length;

    expect(wordCount).toBeLessThanOrEqual(100);
  });

  it("contains exactly 50 valid baseline submissions", () => {
    expect(Array.isArray(submissions)).toBe(true);

    const parsed = submissionSchema.array().parse(submissions);

    expect(parsed).toHaveLength(50);
  });

  it("uses unique IDs and avoids accidental exact duplicate content", () => {
    const parsed = submissionSchema.array().parse(submissions);
    const ids = parsed.map(({ id }) => id);
    const content = parsed.map(({ headline, body }) =>
      `${headline.trim()}\n${body.trim()}`.toLowerCase(),
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(content).size).toBe(content.length);
  });

  it("represents every perspective more than once", () => {
    const parsed = submissionSchema.array().parse(submissions);

    for (const perspective of PERSPECTIVES) {
      expect(
        parsed.filter((submission) => submission.perspective === perspective)
          .length,
      ).toBeGreaterThan(1);
    }
  });

  it("keeps every baseline submission tied to the announced product", () => {
    const parsed = submissionSchema.array().parse(submissions);
    const productSignals =
      /support|agent|customer|conversation|summar|action item|recurring issue|slack|help-desk|workflow|language|analytics|administrator|assistant|ai /u;

    for (const submission of parsed) {
      expect(searchableText(submission)).toMatch(productSignals);
    }
  });

  it.each([
    ["time savings", /time|faster|quicker|busywork|productivity/u],
    ["privacy", /privacy|personal information|sensitive/u],
    ["retention", /retention|retain|delet/u],
    ["accuracy", /accuracy|incorrect|correct summary|wrong owner/u],
    ["human oversight", /human review|agents? (?:can|should) (?:edit|approve)|corrections?/u],
    ["workflow integration", /slack|help-desk|workflow|ticket/u],
    ["multilingual support", /language|dialect|translation/u],
    ["customer trust", /customer trust|confidence|transparency|opt-out/u],
    ["admin controls", /administrators? (?:should|need|can)|admin configuration|settings/u],
    ["analytics", /analytics|trends?|recurring issue/u],
    ["security", /security|encrypt|permissions|audit access/u],
    ["action-item automation", /action item|follow-up|tasks?/u],
  ])("contains a repeated %s theme", (_theme, signal) => {
    const parsed = submissionSchema.array().parse(submissions);
    const matchingSubmissions = parsed.filter((submission) =>
      signal.test(searchableText(submission)),
    );

    expect(matchingSubmissions.length).toBeGreaterThanOrEqual(2);
  });
});

describe("labeled evaluation data", () => {
  it("contains 21-35 valid cases and represents every required category", () => {
    const parsed = labeledEvaluationCasesSchema.parse(labeledCases);

    expect(parsed.length).toBeGreaterThanOrEqual(21);
    expect(parsed.length).toBeLessThanOrEqual(35);

    for (const category of EVALUATION_CATEGORIES) {
      expect(parsed.some((item) => item.category === category)).toBe(true);
    }
  });

  it("keeps evaluation candidate IDs out of the baseline", () => {
    const baseline = submissionSchema.array().parse(submissions);
    const evaluation = labeledEvaluationCasesSchema.parse(labeledCases);
    const baselineIds = new Set(baseline.map(({ id }) => id));

    for (const { candidate } of evaluation) {
      expect(baselineIds.has(candidate.id)).toBe(false);
    }
  });

  it("uses baseline content only for intentional exact-duplicate cases", () => {
    const baseline = submissionSchema.array().parse(submissions);
    const evaluation = labeledEvaluationCasesSchema.parse(labeledCases);
    const baselineContent = new Set(
      baseline.map(
        ({ headline, body, perspective }) =>
          `${headline}\n${body}\n${perspective}`.toLowerCase(),
      ),
    );

    for (const { category, candidate } of evaluation) {
      const content = `${candidate.headline}\n${candidate.body}\n${candidate.perspective}`.toLowerCase();
      expect(baselineContent.has(content)).toBe(category === "duplicate");
    }
  });
});
