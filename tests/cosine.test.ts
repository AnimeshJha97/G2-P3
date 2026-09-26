import { describe, expect, it } from "vitest";

import { cosineSimilarity } from "../src/similarity/cosine.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("clamps negative cosine similarity to 0", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(0);
  });

  it("rejects vectors with different dimensions", () => {
    expect(() => cosineSimilarity([1, 0], [1])).toThrow(
      "Embedding dimensions do not match",
    );
  });

  it("rejects empty vectors", () => {
    expect(() => cosineSimilarity([], [])).toThrow(
      "Cannot compare empty vectors",
    );
  });

  it("rejects zero-magnitude vectors", () => {
    expect(() => cosineSimilarity([0, 0], [1, 0])).toThrow(
      "Cannot compare zero-magnitude vectors",
    );
  });
});
