import { clampToUnitInterval } from "./clamp.js";

export const calculateFinalScore = (
  rawNovelty: number,
  relevanceGate: number,
): number => clampToUnitInterval(rawNovelty * relevanceGate);
