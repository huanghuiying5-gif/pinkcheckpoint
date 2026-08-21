import { calibrateXunfeiScores } from "../../../../src/services/analysis/xunfeiScoreCalibration.js";
import type {
  SpeechAnalysisInput,
  SpeechAnalyzer,
  SpeechFeedbackResult,
} from "../../../../src/services/analysis/types.js";

import { parseXunfeiEvaluationXml } from "./XunfeiResultParser.js";
import { XunfeiWebSocketClient } from "./XunfeiWebSocketClient.js";
import {
  XunfeiProviderError,
  XunfeiProviderUnavailableError,
} from "./XunfeiTypes.js";
import type {
  ResolvedXunfeiProviderConfig,
  XunfeiProviderConfig,
  XunfeiRawResult,
  XunfeiStreamingMetrics,
  XunfeiWebSocketFactory,
} from "./XunfeiTypes.js";

const MAX_REFERENCE_TEXT_LENGTH = 5_000;

function requiredConfig(config: XunfeiProviderConfig): ResolvedXunfeiProviderConfig {
  if (!config.appId || !config.apiKey || !config.apiSecret) {
    throw new XunfeiProviderUnavailableError();
  }
  if (!config.iseUrl.startsWith("wss://")) {
    throw new XunfeiProviderError("Xunfei endpoint must use secure WebSockets.");
  }
  return {
    ...config,
    appId: config.appId,
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
  };
}

function sanitizeReferenceText(referenceText: string | undefined): string {
  if (typeof referenceText !== "string") {
    throw new XunfeiProviderError("A reading passage is required for Xunfei evaluation.");
  }
  const normalized = referenceText.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    throw new XunfeiProviderError("A reading passage is required for Xunfei evaluation.");
  }
  if (normalized.length > MAX_REFERENCE_TEXT_LENGTH) {
    throw new XunfeiProviderError("The reading passage exceeds the evaluation limit.");
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    throw new XunfeiProviderError("The reading passage contains unsupported control characters.");
  }
  return normalized;
}

function commentsFor(
  dimension: "rhythm" | "fluency" | "clarity",
  rating: number,
): string {
  if (dimension === "rhythm") {
    return rating >= 4.5
      ? "Your rhythm feels natural and expressive."
      : "Your sense of rhythm is developing well.";
  }
  if (dimension === "fluency") {
    return rating >= 4.5
      ? "Your speech flows smoothly and confidently."
      : "Your reading shows good flow and control.";
  }
  return rating >= 4.5
    ? "Your message is easy to understand."
    : "Your voice is clear and easy to follow.";
}

export function mapXunfeiRawResult(raw: XunfeiRawResult): SpeechFeedbackResult {
  const scores = calibrateXunfeiScores({
    accuracy: raw.accuracyScore,
    fluency: raw.fluencyScore,
    completeness: raw.integrityScore,
    standard: raw.standardScore,
  });
  const average = (scores.rhythm + scores.fluency + scores.clarity) / 3;
  return {
    ...scores,
    praise: average >= 4.67 ? "Excellent!" : "Wonderful!",
    comments: {
      rhythm: commentsFor("rhythm", scores.rhythm),
      fluency: commentsFor("fluency", scores.fluency),
      clarity: commentsFor("clarity", scores.clarity),
    },
  };
}

/** Server-only adapter for Xunfei's streaming English chapter evaluation API. */
export class XunfeiAnalyzer implements SpeechAnalyzer {
  constructor(
    private readonly config: XunfeiProviderConfig,
    private readonly socketFactory?: XunfeiWebSocketFactory,
  ) {}

  async evaluateRaw(
    input: SpeechAnalysisInput,
    onMetrics?: (metrics: XunfeiStreamingMetrics) => void,
  ): Promise<XunfeiRawResult> {
    const config = requiredConfig(this.config);
    const referenceText = sanitizeReferenceText(input.referenceText);
    const normalizedAudio = input.audio?.normalized;
    if (!normalizedAudio) {
      throw new XunfeiProviderError("Normalized PCM audio is required for Xunfei evaluation.");
    }
    if (
      normalizedAudio.format !== "pcm_s16le" ||
      normalizedAudio.sampleRate !== 16_000 ||
      normalizedAudio.channels !== 1 ||
      normalizedAudio.bitDepth !== 16 ||
      normalizedAudio.data.byteLength === 0
    ) {
      throw new XunfeiProviderError("Audio does not meet Xunfei PCM requirements.");
    }

    const client = new XunfeiWebSocketClient(config, this.socketFactory);
    const finalResponse = await client.evaluate({
      audio: normalizedAudio.data,
      referenceText,
      signal: input.signal,
      onMetrics,
    });
    return parseXunfeiEvaluationXml(finalResponse.xml, finalResponse.sid);
  }

  async analyze(input: SpeechAnalysisInput): Promise<SpeechFeedbackResult> {
    return mapXunfeiRawResult(await this.evaluateRaw(input));
  }
}
