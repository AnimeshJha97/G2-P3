import type { EmbeddingProvider } from "../embeddings/embedding-provider.js";
import { cosineSimilarity } from "../similarity/cosine.js";
import { tokenJaccardSimilarity } from "../similarity/lexical.js";
import { toSemanticText } from "../text/canonicalize.js";
import { tokenizeLexicalText, toLexicalText } from "../text/normalize.js";
import type { FixedContent } from "../types/fixed-content.js";
import type {
  NeighborScore,
  NoveltyScoreResult,
  ScoringConfig,
} from "../types/score.js";
import { submissionSchema, type Submission } from "../types/submission.js";
import { validateScoringConfig } from "../config/scoring-config.js";
import { calculateFinalScore } from "./final-score.js";
import { calculateLexicalNovelty } from "./lexical-novelty.js";
import {
  type PreparedScoringContext,
  prepareScoringContext,
} from "./prepare-scoring-context.js";
import { calculateRawNovelty } from "./raw-novelty.js";
import { calculateRelevanceGate } from "./relevance-gate.js";
import {
  aggregateTopKSemanticSimilarity,
  calculateSemanticNovelty,
  selectTopSemanticMatches,
  type SemanticMatch,
} from "./semantic-novelty.js";

interface BaselineComparison extends SemanticMatch {
  lexicalSimilarity: number;
}

export class NoveltyScorer {
  private readonly config: ScoringConfig;

  public constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    config: ScoringConfig,
  ) {
    validateScoringConfig(config);
    this.config = {
      ...config,
      semanticNeighborWeights: [...config.semanticNeighborWeights],
    };
  }

  public prepare(
    fixedContent: FixedContent,
    baselineSubmissions: readonly Submission[],
  ): Promise<PreparedScoringContext> {
    return prepareScoringContext(
      fixedContent,
      baselineSubmissions,
      this.embeddingProvider,
    );
  }

  public async score(
    candidate: Submission,
    prepared: PreparedScoringContext,
  ): Promise<NoveltyScoreResult> {
    const validatedCandidate = submissionSchema.parse(candidate);

    if (prepared.baselines.length === 0) {
      throw new Error("At least one baseline submission is required");
    }

    if (
      prepared.baselines.some(
        ({ submission }) => submission.id === validatedCandidate.id,
      )
    ) {
      throw new Error("Candidate ID must not match a baseline submission ID");
    }

    const candidateEmbedding = await this.embeddingProvider.embed(
      toSemanticText(validatedCandidate),
    );
    const candidateLexicalTokens = tokenizeLexicalText(
      toLexicalText(validatedCandidate),
    );

    const comparisons: BaselineComparison[] = prepared.baselines.map(
      ({ submission, vector }) => ({
        submissionId: submission.id,
        similarity: cosineSimilarity(candidateEmbedding, vector),
        lexicalSimilarity: tokenJaccardSimilarity(
          candidateLexicalTokens,
          tokenizeLexicalText(toLexicalText(submission)),
        ),
      }),
    );

    const topSemanticMatches = selectTopSemanticMatches(
      comparisons,
      this.config.topK,
    );
    const aggregatedSemanticSimilarity = aggregateTopKSemanticSimilarity(
      topSemanticMatches.map(({ similarity }) => similarity),
      this.config.topK,
      this.config.semanticNeighborWeights,
    );
    const semanticNovelty = calculateSemanticNovelty(
      aggregatedSemanticSimilarity,
    );

    const maxLexicalComparison = comparisons.reduce((best, comparison) =>
      comparison.lexicalSimilarity > best.lexicalSimilarity ? comparison : best,
    );
    const maxLexicalSimilarity = maxLexicalComparison.lexicalSimilarity;
    const lexicalNovelty = calculateLexicalNovelty(maxLexicalSimilarity);
    const semanticContribution =
      this.config.semanticWeight * semanticNovelty;
    const lexicalContribution = this.config.lexicalWeight * lexicalNovelty;
    const rawNovelty = calculateRawNovelty(
      semanticNovelty,
      lexicalNovelty,
      this.config.semanticWeight,
      this.config.lexicalWeight,
    );

    const relevanceSimilarity = cosineSimilarity(
      candidateEmbedding,
      prepared.fixedContentEmbedding,
    );
    const relevanceGate = calculateRelevanceGate(
      relevanceSimilarity,
      this.config.relevanceLow,
      this.config.relevanceHigh,
    );
    const finalScore = calculateFinalScore(rawNovelty, relevanceGate);

    const activeSemanticWeights = this.config.semanticNeighborWeights.slice(
      0,
      topSemanticMatches.length,
    );
    const activeSemanticWeightSum = activeSemanticWeights.reduce(
      (sum, weight) => sum + weight,
      0,
    );
    const weightedSemanticSimilaritySum = topSemanticMatches.reduce(
      (sum, { similarity }, index) =>
        sum + similarity * activeSemanticWeights[index],
      0,
    );
    const nearestNeighbors: NeighborScore[] = topSemanticMatches.map(
      ({ submissionId, similarity, lexicalSimilarity }, index) => ({
        rank: index + 1,
        submissionId,
        semanticSimilarity: similarity,
        lexicalSimilarity,
        semanticAggregationWeight:
          activeSemanticWeights[index] / activeSemanticWeightSum,
        semanticSimilarityContribution:
          (similarity * activeSemanticWeights[index]) /
          activeSemanticWeightSum,
      }),
    );

    return {
      finalScore,
      semantic: {
        topK: topSemanticMatches.length,
        weightSum: activeSemanticWeightSum,
        weightedSimilaritySum: weightedSemanticSimilaritySum,
        aggregatedSimilarity: aggregatedSemanticSimilarity,
        novelty: semanticNovelty,
      },
      lexical: {
        mostSimilarSubmissionId: maxLexicalComparison.submissionId,
        maxSimilarity: maxLexicalSimilarity,
        novelty: lexicalNovelty,
      },
      rawNovelty,
      rawNoveltyComponents: {
        semanticWeight: this.config.semanticWeight,
        semanticContribution,
        lexicalWeight: this.config.lexicalWeight,
        lexicalContribution,
      },
      relevance: {
        similarity: relevanceSimilarity,
        low: this.config.relevanceLow,
        high: this.config.relevanceHigh,
        gate: relevanceGate,
      },
      nearestNeighbors,
    };
  }
}
