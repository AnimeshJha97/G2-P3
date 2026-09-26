import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  LocalEmbeddingProvider,
} from "../src/index.js";

const norm = (vector: readonly number[]): number =>
  Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

describe("LocalEmbeddingProvider integration", () => {
  it(
    "produces stable normalized embeddings with meaningful semantic similarity",
    async () => {
      const provider = new LocalEmbeddingProvider();
      const texts = [
        "Automatic summaries help support agents handle customer conversations faster.",
        "Support teams save time when customer chats are summarized automatically.",
        "Volcanic rocks form when molten lava cools and hardens.",
      ];

      const embeddings = await provider.embedMany(texts);

      expect(embeddings).toHaveLength(texts.length);
      expect(embeddings[0].length).toBeGreaterThan(0);
      expect(embeddings.every((vector) => vector.length === embeddings[0].length))
        .toBe(true);
      expect(embeddings.every((vector) => Math.abs(norm(vector) - 1) < 0.001))
        .toBe(true);

      const similarScore = cosineSimilarity(embeddings[0], embeddings[1]);
      const unrelatedScore = cosineSimilarity(embeddings[0], embeddings[2]);
      expect(similarScore).toBeGreaterThan(unrelatedScore);

      const reusedEmbedding = await provider.embed(texts[0]);
      expect(reusedEmbedding).toEqual(embeddings[0]);
      expect(reusedEmbedding).not.toBe(embeddings[0]);
    },
    120_000,
  );
});
