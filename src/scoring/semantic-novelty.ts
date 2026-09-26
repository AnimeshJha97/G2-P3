import { clampToUnitInterval } from "./clamp.js";

export interface SemanticMatch {
  submissionId: string;
  similarity: number;
}

const assertValidTopK = (topK: number): void => {
  if (!Number.isInteger(topK) || topK <= 0) {
    throw new Error("topK must be a positive integer");
  }
};

export const selectTopSemanticMatches = <T extends SemanticMatch>(
  matches: readonly T[],
  topK: number,
): T[] => {
  assertValidTopK(topK);

  return [...matches]
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, topK);
};

export const aggregateTopKSemanticSimilarity = (
  similarities: readonly number[],
  topK: number,
  weights: readonly number[],
): number => {
  assertValidTopK(topK);

  if (similarities.length === 0) {
    throw new Error("At least one semantic similarity is required");
  }

  if (weights.length < topK) {
    throw new Error("semanticNeighborWeights must contain at least topK values");
  }

  const activeSimilarities = [...similarities]
    .sort((left, right) => right - left)
    .slice(0, topK);
  const activeWeights = weights.slice(0, activeSimilarities.length);

  if (activeWeights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("Active semantic neighbor weights must be non-negative");
  }

  const activeWeightSum = activeWeights.reduce(
    (sum, weight) => sum + weight,
    0,
  );

  if (activeWeightSum <= 0) {
    throw new Error("Active semantic neighbor weights must have a positive sum");
  }

  const weightedSimilarity = activeSimilarities.reduce(
    (sum, similarity, index) => sum + similarity * activeWeights[index],
    0,
  );

  return clampToUnitInterval(weightedSimilarity / activeWeightSum);
};

export const calculateSemanticNovelty = (
  aggregatedSimilarity: number,
): number => clampToUnitInterval(1 - aggregatedSimilarity);
