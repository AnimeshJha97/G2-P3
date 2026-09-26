export const clampToUnitInterval = (value: number): number =>
  Math.min(1, Math.max(0, value));
