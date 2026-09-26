export const calculateRelevanceGate = (
  relevance: number,
  relevanceLow: number,
  relevanceHigh: number,
): number => {
  if (relevanceHigh <= relevanceLow) {
    throw new Error("relevanceHigh must be greater than relevanceLow");
  }

  if (relevance <= relevanceLow) {
    return 0;
  }

  if (relevance >= relevanceHigh) {
    return 1;
  }

  return (relevance - relevanceLow) / (relevanceHigh - relevanceLow);
};
