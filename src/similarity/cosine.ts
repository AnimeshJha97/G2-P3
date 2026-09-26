import { clampToUnitInterval } from "../scoring/clamp.js";

export const cosineSimilarity = (
  a: readonly number[],
  b: readonly number[],
): number => {
  if (a.length === 0 || b.length === 0) {
    throw new Error("Cannot compare empty vectors");
  }

  if (a.length !== b.length) {
    throw new Error("Embedding dimensions do not match");
  }

  let dotProduct = 0;
  let magnitudeASquared = 0;
  let magnitudeBSquared = 0;

  for (let index = 0; index < a.length; index += 1) {
    const aValue = a[index];
    const bValue = b[index];

    dotProduct += aValue * bValue;
    magnitudeASquared += aValue * aValue;
    magnitudeBSquared += bValue * bValue;
  }

  if (magnitudeASquared === 0 || magnitudeBSquared === 0) {
    throw new Error("Cannot compare zero-magnitude vectors");
  }

  const rawSimilarity =
    dotProduct / (Math.sqrt(magnitudeASquared) * Math.sqrt(magnitudeBSquared));

  return clampToUnitInterval(rawSimilarity);
};
