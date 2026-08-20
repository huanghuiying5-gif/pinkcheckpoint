import type {
  SpeechAnalysisInput,
  SpeechAnalyzer,
  SpeechFeedbackResult,
} from "./types.js";
import { calibrateXunfeiScores } from "./xunfeiScoreCalibration.js";
import type { XunfeiRawResult } from "./xunfeiScoreCalibration.js";

function messageFor(
  dimension: "rhythm" | "fluency" | "clarity",
  rating: number,
): string {
  if (dimension === "rhythm") {
    return rating >= 4.5
      ? "Your rhythm feels natural and expressive."
      : "Your rhythm is growing with each reading.";
  }
  if (dimension === "fluency") {
    return rating >= 4.5
      ? "Your speech flows smoothly and confidently."
      : "Your reading is becoming more connected.";
  }
  return rating >= 4.5
    ? "Your message is easy to understand."
    : "Your message is becoming easier to follow.";
}

/** Maps future Xunfei data into the same contract used by every provider. */
export function mapXunfeiRawResult(
  raw: XunfeiRawResult,
): SpeechFeedbackResult {
  const scores = calibrateXunfeiScores(raw);
  const average = (scores.rhythm + scores.fluency + scores.clarity) / 3;

  return {
    ...scores,
    praise: average >= 4.67 ? "Excellent!" : "Wonderful!",
    comments: {
      rhythm: messageFor("rhythm", scores.rhythm),
      fluency: messageFor("fluency", scores.fluency),
      clarity: messageFor("clarity", scores.clarity),
    },
  };
}

export class XunfeiAnalyzerUnavailableError extends Error {
  constructor() {
    super("Xunfei speech evaluation has not been configured yet.");
    this.name = "XunfeiAnalyzerUnavailableError";
  }
}

/**
 * Server-side Xunfei provider boundary.
 *
 * Phase 2 will add credential handling, provider transport, response mapping,
 * and a request timeout here. The server-side transport already supplies
 * normalized PCM and reference text through SpeechAnalysisInput. Raw provider
 * scores will pass through mapXunfeiRawResult before leaving this adapter. The
 * rest of the application will continue to depend only on SpeechAnalyzer and
 * SpeechFeedbackResult.
 */
export class XunfeiAnalyzer implements SpeechAnalyzer {
  async analyze(
    _input: SpeechAnalysisInput,
  ): Promise<SpeechFeedbackResult> {
    throw new XunfeiAnalyzerUnavailableError();
  }
}
