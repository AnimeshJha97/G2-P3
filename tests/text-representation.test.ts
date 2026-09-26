import { describe, expect, it } from "vitest";

import {
  normalizeLexicalText,
  toFixedContentText,
  toLexicalText,
  toSemanticText,
} from "../src/index.js";
import type { Submission } from "../src/types/index.js";

const submission: Submission = {
  id: "submission-001",
  headline: "  Privacy controls should be explicit  ",
  body: "  Companies need clear retention controls.  ",
  perspective: "concern",
};

describe("semantic text representation", () => {
  it("uses the documented deterministic field format", () => {
    expect(toSemanticText(submission)).toBe(
      [
        "Headline: Privacy controls should be explicit",
        "Body: Companies need clear retention controls.",
        "Perspective: concern",
      ].join("\n"),
    );
  });

  it("formats fixed content with an optional non-blank title", () => {
    expect(
      toFixedContentText({
        id: "announcement-001",
        title: "  New support feature  ",
        body: "  A company announced an AI support feature.  ",
      }),
    ).toBe(
      "Title: New support feature\nBody: A company announced an AI support feature.",
    );

    expect(
      toFixedContentText({
        id: "announcement-001",
        title: "   ",
        body: "  A company announced an AI support feature.  ",
      }),
    ).toBe("A company announced an AI support feature.");
  });
});

describe("lexical text representation", () => {
  it("combines only the headline and body", () => {
    expect(toLexicalText(submission)).toBe(
      "Privacy controls should be explicit Companies need clear retention controls.",
    );
    expect(toLexicalText(submission)).not.toContain("concern");
  });

  it("normalizes Unicode, case, punctuation, and whitespace", () => {
    expect(
      normalizeLexicalText("  ＡＩ Summaries: GREAT—for\n\tSupport!  "),
    ).toBe("ai summaries great for support");
  });

  it("keeps stop words", () => {
    expect(normalizeLexicalText("Useful for the support team")).toBe(
      "useful for the support team",
    );
  });
});
