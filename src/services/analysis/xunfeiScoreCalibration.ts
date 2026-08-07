import type { SupportedStarRating } from "./types.js";

export interface XunfeiRawResult {
  accuracy: number;
  fluency: number;
  completeness: number;
}

export interface CalibratedXunfeiScores {
  rhythm: SupportedStarRating;
  fluency: SupportedStarRating;
  clarity: SupportedStarRating;
}

const normalizeRawScore = (value: number) =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

function calibrate(
  value: number,
  thresholds: readonly [number, number, number],
): SupportedStarRating {
  if (value >= thresholds[2]) {
    return 5;
  }
  if (value >= thresholds[1]) {
    return 4.5;
  }
  if (value >= thresholds[0]) {
    return 4;
  }
  return 3.5;
}

/** Converts provider-specific 0–100 scores into classroom reflection stars. */
export function calibrateXunfeiScores(
  raw: XunfeiRawResult,
): CalibratedXunfeiScores {
  const accuracy = normalizeRawScore(raw.accuracy);
  const fluency = normalizeRawScore(raw.fluency);
  const completeness = normalizeRawScore(raw.completeness);
  const rhythmSignal = fluency * 0.65 + completeness * 0.35;

  return {
    rhythm: calibrate(rhythmSignal, [76, 86, 94]),
    fluency: calibrate(fluency, [80, 84, 92]),
    clarity: calibrate(accuracy, [74, 83, 93]),
  };
}
