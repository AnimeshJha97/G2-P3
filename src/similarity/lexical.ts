export const tokenJaccardSimilarity = (
  aTokens: readonly string[],
  bTokens: readonly string[],
): number => {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  const union = new Set([...a, ...b]);

  if (union.size === 0) {
    return 0;
  }

  let intersectionSize = 0;

  for (const token of a) {
    if (b.has(token)) {
      intersectionSize += 1;
    }
  }

  return intersectionSize / union.size;
};
