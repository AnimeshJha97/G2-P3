import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEMO_CASE_IDS,
  renderEvaluationMarkdown,
  type EvaluationReport,
  type FixedContent,
  type Submission,
} from "../src/index.js";

const loadJson = <T>(relativePath: string): T =>
  JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  ) as T;

describe("evaluation Markdown report", () => {
  it("stays synchronized with the machine-readable results", () => {
    const report = loadJson<EvaluationReport>("../evaluation/results.json");
    const baselines = loadJson<Submission[]>("../data/submissions.json");
    const fixedContent = loadJson<FixedContent>("../data/fixed-content.json");
    const committedMarkdown = readFileSync(
      new URL("../evaluation/results.md", import.meta.url),
      "utf8",
    );

    expect(renderEvaluationMarkdown(report, baselines, fixedContent)).toBe(committedMarkdown);
  });

  it("retains every failure and all three selected demo cases", () => {
    const report = loadJson<EvaluationReport>("../evaluation/results.json");
    const baselines = loadJson<Submission[]>("../data/submissions.json");
    const fixedContent = loadJson<FixedContent>("../data/fixed-content.json");
    const markdown = renderEvaluationMarkdown(report, baselines, fixedContent);

    for (const failedCase of report.failedCases) {
      expect(markdown).toContain(failedCase.id);
    }
    for (const demoCaseId of Object.values(DEMO_CASE_IDS)) {
      expect(markdown).toContain(demoCaseId);
    }
    expect(markdown).toContain(
      "Novel-relevant mean final > paraphrase | -0.026 margin | FAIL",
    );
  });
});
