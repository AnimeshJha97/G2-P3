import { clampToUnitInterval } from "./clamp.js";

export const calculateRawNovelty = (
  semanticNovelty: number,
  lexicalNovelty: number,
  semanticWeight: number,
  lexicalWeight: number,
): number =>
  clampToUnitInterval(
    semanticWeight * semanticNovelty + lexicalWeight * lexicalNovelty,
  );
