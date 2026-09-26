export interface NeighborScore {
  submissionId: string;
  semanticSimilarity: number;
  lexicalSimilarity: number;
}

export interface NoveltyScoreResult {
  finalScore: number;
  semantic: {
    topK: number;
    aggregatedSimilarity: number;
    novelty: number;
  };
  lexical: {
    maxSimilarity: number;
    novelty: number;
  };
  rawNovelty: number;
  relevance: {
    similarity: number;
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
