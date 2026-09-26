import { describe, expect, it } from "vitest";

import {
  fixedContentSchema,
  PERSPECTIVES,
  perspectiveSchema,
  submissionSchema,
} from "../src/types/index.js";

describe("submission validation", () => {
  const validSubmission = {
    id: "submission-001",
    headline: "Privacy controls matter",
    body: "Organizations need clear retention controls.",
    perspective: "concern" as const,
  };

  it("accepts the documented submission shape", () => {
    expect(submissionSchema.parse(validSubmission)).toEqual(validSubmission);
  });

  it("supports exactly the five documented perspectives", () => {
    expect(PERSPECTIVES).toEqual([
      "support",
      "concern",
      "question",
      "suggestion",
      "observation",
    ]);

    for (const perspective of PERSPECTIVES) {
      expect(perspectiveSchema.safeParse(perspective).success).toBe(true);
    }

    expect(perspectiveSchema.safeParse("neutral").success).toBe(false);
  });

  it("rejects empty required text and unknown fields", () => {
    expect(
      submissionSchema.safeParse({ ...validSubmission, headline: "   " }).success,
    ).toBe(false);
    expect(
      submissionSchema.safeParse({ ...validSubmission, extra: "not allowed" })
        .success,
    ).toBe(false);
  });
});

describe("fixed-content validation", () => {
  const bodyWithWords = (count: number): string =>
    Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");

  it("accepts a non-empty body containing exactly 100 words", () => {
    expect(
      fixedContentSchema.safeParse({
        id: "announcement-001",
        title: "Product announcement",
        body: bodyWithWords(100),
      }).success,
    ).toBe(true);
  });

  it("rejects an empty body", () => {
    expect(
      fixedContentSchema.safeParse({ id: "announcement-001", body: "   " })
        .success,
    ).toBe(false);
  });

  it("rejects a body containing more than 100 words", () => {
    expect(
      fixedContentSchema.safeParse({
        id: "announcement-001",
        body: bodyWithWords(101),
      }).success,
    ).toBe(false);
  });
});
