import { describe, expect, it } from "vitest";

import { tokenJaccardSimilarity } from "../src/similarity/lexical.js";
import { tokenizeLexicalText } from "../src/text/normalize.js";

const similarity = (left: string, right: string): number =>
  tokenJaccardSimilarity(
    tokenizeLexicalText(left),
    tokenizeLexicalText(right),
  );

describe("tokenJaccardSimilarity", () => {
  it("returns 1 for the same normalized token set", () => {
    expect(similarity("Privacy Controls Matter!", "privacy controls matter")).toBe(
      1,
    );
  });

  it("returns an intermediate value for partial overlap", () => {
    expect(
      similarity("privacy controls matter", "privacy and retention controls"),
    ).toBeCloseTo(0.4);
  });

  it("returns 0 when token sets do not overlap", () => {
    expect(
      similarity(
        "privacy retention controls",
        "formula racing aerodynamics",
      ),
    ).toBe(0);
  });

  it("returns 0 for two empty token sets", () => {
    expect(tokenJaccardSimilarity([], [])).toBe(0);
  });

  it("treats repeated tokens as set members", () => {
    expect(tokenJaccardSimilarity(["privacy", "privacy"], ["privacy"])).toBe(1);
  });
});
