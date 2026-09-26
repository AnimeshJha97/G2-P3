export interface NeighborScore {
  rank: number;
  submissionId: string;
  semanticSimilarity: number;
  lexicalSimilarity: number;
  semanticAggregationWeight: number;
  semanticSimilarityContribution: number;
}

export interface NoveltyScoreResult {
  finalScore: number;
  semantic: {
    topK: number;
    weightSum: number;
    weightedSimilaritySum: number;
    aggregatedSimilarity: number;
    novelty: number;
  };
  lexical: {
    mostSimilarSubmissionId: string;
    maxSimilarity: number;
    novelty: number;
  };
  rawNovelty: number;
  rawNoveltyComponents: {
    semanticWeight: number;
    semanticContribution: number;
    lexicalWeight: number;
    lexicalContribution: number;
  };
  relevance: {
    similarity: number;
    low: number;
    high: number;
    gate: number;
  };
  nearestNeighbors: NeighborScore[];
  configVersion?: string;
}

export interface ScoringConfig {
  topK: number;
  semanticNeighborWeights: number[];
  semanticWeight: number;
  lexicalWeight: number;
  relevanceLow: number;
  relevanceHigh: number;
  duplicateSemanticThreshold?: number;
  duplicateLexicalThreshold?: number;
}
