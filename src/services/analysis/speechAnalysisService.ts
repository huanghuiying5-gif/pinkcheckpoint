import type {
  AnalysisLogger,
  AnalysisMode,
  SpeechAnalysisInput,
  SpeechAnalyzer,
  SpeechFeedbackResult,
} from "./types.js";
import { SAFE_CLASSROOM_FEEDBACK } from "./types.js";

export interface SpeechAnalysisServiceOptions {
  mode: AnalysisMode;
  mockAnalyzer: SpeechAnalyzer;
  xunfeiAnalyzer: SpeechAnalyzer;
  logger?: AnalysisLogger;
}

const defaultLogger: AnalysisLogger = {
  info(message, details) {
    details ? console.info(message, details) : console.info(message);
  },
  warn(message, details) {
    details ? console.warn(message, details) : console.warn(message);
  },
};

function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return "Unknown provider failure";
}

export class SpeechAnalysisService {
  private readonly mode: AnalysisMode;
  private readonly mockAnalyzer: SpeechAnalyzer;
  private readonly xunfeiAnalyzer: SpeechAnalyzer;
  private readonly logger: AnalysisLogger;

  constructor(options: SpeechAnalysisServiceOptions) {
    this.mode = options.mode;
    this.mockAnalyzer = options.mockAnalyzer;
    this.xunfeiAnalyzer = options.xunfeiAnalyzer;
    this.logger = options.logger ?? defaultLogger;
  }

  private async runMockAnalyzer(
    input: SpeechAnalysisInput,
  ): Promise<SpeechFeedbackResult> {
    try {
      return await this.mockAnalyzer.analyze(input);
    } catch (error) {
      this.logger.warn(
        "Mock speech analysis failed; using the classroom-safe default feedback.",
        { reason: describeFailure(error) },
      );
      return SAFE_CLASSROOM_FEEDBACK;
    }
  }

  async analyze(input: SpeechAnalysisInput): Promise<SpeechFeedbackResult> {
    if (this.mode === "mock") {
      const result = await this.runMockAnalyzer(input);
      this.logger.info?.(
        "Speech analysis result source: MOCK (AI_MODE=mock); no Xunfei request was made.",
      );
      return result;
    }

    try {
      const result = await this.xunfeiAnalyzer.analyze(input);
      this.logger.info?.(
        "Speech analysis result source: REAL XUNFEI (provider response received).",
      );
      return result;
    } catch (error) {
      this.logger.warn(
        "Speech analysis result source: MOCK/FALLBACK; Xunfei speech evaluation failed; using classroom-safe mock feedback.",
        { reason: describeFailure(error) },
      );
      return this.runMockAnalyzer(input);
    }
  }
}
