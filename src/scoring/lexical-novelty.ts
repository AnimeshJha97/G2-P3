import { clampToUnitInterval } from "./clamp.js";

export const calculateLexicalNovelty = (
  maxLexicalSimilarity: number,
): number => clampToUnitInterval(1 - maxLexicalSimilarity);
