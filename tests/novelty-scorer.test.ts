import { describe, expect, it } from "vitest";

import {
  type EmbeddingProvider,
  type FixedContent,
  NoveltyScorer,
  type ScoringConfig,
  type Submission,
  toFixedContentText,
  toSemanticText,
} from "../src/index.js";

class MockEmbeddingProvider implements EmbeddingProvider {
  public readonly embedInputs: string[] = [];
  public readonly embedManyInputs: string[][] = [];

  public constructor(
    private readonly embeddings: ReadonlyMap<string, readonly number[]>,
  ) {}

  public async embed(text: string): Promise<number[]> {
    this.embedInputs.push(text);
    return this.embeddingFor(text);
  }

  public async embedMany(texts: string[]): Promise<number[][]> {
    this.embedManyInputs.push([...texts]);
    return texts.map((text) => this.embeddingFor(text));
  }

  private embeddingFor(text: string): number[] {
    const vector = this.embeddings.get(text);
    if (!vector) {
      throw new Error(`No mocked embedding for: ${text}`);
    }

    return [...vector];
  }
}

const fixedContent: FixedContent = {
  id: "source-001",
  title: "AI support summaries",
  body: "A support platform now creates automatic conversation summaries for agents.",
};

const baselines: Submission[] = [
  {
    id: "baseline-001",
    headline: "Faster handoffs",
    body: "Automatic digests reduce agent handling time.",
    perspective: "support",
  },
  {
    id: "baseline-002",
    headline: "Retention controls",
    body: "Administrators need deletion settings for stored records.",
    perspective: "concern",
  },
  {
    id: "baseline-003",
    headline: "Language coverage",
    body: "Teams require dependable multilingual output.",
    perspective: "suggestion",
  },
];

const duplicateCandidate: Submission = {
  ...baselines[0],
  id: "candidate-duplicate",
};

const novelRelevantCandidate: Submission = {
  id: "candidate-novel-relevant",
  headline: "Track corrections",
  body: "Preserve revision lineage for downstream analytics.",
  perspective: "suggestion",
};

const novelIrrelevantCandidate: Submission = {
  id: "candidate-novel-irrelevant",
  headline: "Change racing rules",
  body: "Formula One teams should receive more aerodynamic testing time.",
  perspective: "suggestion",
};

const testConfig: ScoringConfig = {
  topK: 3,
  semanticNeighborWeights: [0.6, 0.3, 0.1],
  semanticWeight: 0.85,
  lexicalWeight: 0.15,
  // Mock-only boundaries chosen around the synthetic vectors below, not final
  // thresholds for the real embedding model.
  relevanceLow: 0.05,
  relevanceHigh: 0.15,
};

const createScorer = (): {
  provider: MockEmbeddingProvider;
  scorer: NoveltyScorer;
} => {
  const embeddings = new Map<string, readonly number[]>([
    [toFixedContentText(fixedContent), [1, 0, 0]],
    [toSemanticText(baselines[0]), [0.2, 0.979795897, 0]],
    [toSemanticText(baselines[1]), [0.22, 0.975499872, 0]],
    [toSemanticText(baselines[2]), [0.18, 0.98366661, 0]],
    [toSemanticText(novelRelevantCandidate), [1, 0, 0]],
    [toSemanticText(novelIrrelevantCandidate), [0, 0, 1]],
  ]);
  const provider = new MockEmbeddingProvider(embeddings);

  return {
    provider,
    scorer: new NoveltyScorer(provider, testConfig),
  };
};

describe("NoveltyScorer", () => {
  it("prepares reusable embeddings and gives a duplicate a very low score", async () => {
    const { provider, scorer } = createScorer();
    const prepared = await scorer.prepare(fixedContent, baselines);
    const result = await scorer.score(duplicateCandidate, prepared);

    expect(provider.embedManyInputs).toEqual([
      baselines.map(toSemanticText),
    ]);
    expect(provider.embedInputs).toEqual([
      toFixedContentText(fixedContent),
      toSemanticText(duplicateCandidate),
    ]);
    expect(result.finalScore).toBeLessThan(0.01);
    expect(result.semantic.novelty).toBeLessThan(0.01);
    expect(result.lexical.novelty).toBe(0);
    expect(result.rawNovelty).toBeLessThan(0.01);
    expect(result.relevance.gate).toBe(1);
    expect(result.nearestNeighbors).toHaveLength(3);
    expect(result.nearestNeighbors[0]).toMatchObject({
      rank: 1,
      submissionId: "baseline-001",
      semanticSimilarity: 1,
      lexicalSimilarity: 1,
    });
    expect(
      result.nearestNeighbors[0].semanticAggregationWeight,
    ).toBeCloseTo(0.6);
    expect(
      result.nearestNeighbors[0].semanticSimilarityContribution,
    ).toBeCloseTo(0.6);
    expect(result.semantic.weightSum).toBeCloseTo(1);
    expect(result.semantic.weightedSimilaritySum).toBeCloseTo(
      result.semantic.aggregatedSimilarity,
    );
    expect(result.lexical.mostSimilarSubmissionId).toBe("baseline-001");
    expect(result.rawNoveltyComponents.semanticContribution).toBeCloseTo(
      result.semantic.novelty * testConfig.semanticWeight,
    );
    expect(result.rawNoveltyComponents.lexicalContribution).toBeCloseTo(
      result.lexical.novelty * testConfig.lexicalWeight,
    );
    expect(
      result.rawNoveltyComponents.semanticContribution +
        result.rawNoveltyComponents.lexicalContribution,
    ).toBeCloseTo(result.rawNovelty);
    expect(result.relevance).toMatchObject({
      low: testConfig.relevanceLow,
      high: testConfig.relevanceHigh,
    });
  });

  it("gives a novel, source-relevant submission a high score", async () => {
    const { scorer } = createScorer();
    const prepared = await scorer.prepare(fixedContent, baselines);
    const result = await scorer.score(novelRelevantCandidate, prepared);

    expect(result.semantic.novelty).toBeGreaterThan(0.75);
    expect(result.lexical.novelty).toBeGreaterThan(0.9);
    expect(result.rawNovelty).toBeGreaterThan(0.8);
    expect(result.relevance.similarity).toBe(1);
    expect(result.relevance.gate).toBe(1);
    expect(result.finalScore).toBeCloseTo(result.rawNovelty);
    expect(result.nearestNeighbors.map(({ submissionId }) => submissionId))
      .toEqual(["baseline-002", "baseline-001", "baseline-003"]);
  });

  it("gates a novel but irrelevant submission to zero", async () => {
    const { scorer } = createScorer();
    const prepared = await scorer.prepare(fixedContent, baselines);
    const result = await scorer.score(novelIrrelevantCandidate, prepared);

    expect(result.semantic.novelty).toBe(1);
    expect(result.lexical.novelty).toBeGreaterThan(0.9);
    expect(result.rawNovelty).toBeGreaterThan(0.99);
    expect(result.relevance.similarity).toBe(0);
    expect(result.relevance.gate).toBe(0);
    expect(result.finalScore).toBe(0);
  });
});
