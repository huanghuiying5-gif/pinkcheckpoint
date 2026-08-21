export type AnalysisMode = "mock" | "xunfei";
export type SupportedStarRating = 3.5 | 4 | 4.5 | 5;

export type PraiseWord =
  | "Great Job!"
  | "Wonderful!"
  | "Excellent!"
  | "Amazing!"
  | "Brilliant!";

export interface SpeechAnalysisInput {
  attemptId: string;
  volumeStability: number;
  volumeVariation: number;
  recordingQuality: number;
  voicePresence: number;
  durationSeconds: number;
  signature: number;
  /** The passage shown during this reading attempt. */
  referenceText?: string;
  /** The shared passage revision, when the reading page loaded one. */
  passageRevision?: number;
  /** Populated only by the server-side audio transport before a provider runs. */
  audio?: {
    original: {
      mimeType: string;
      byteLength: number;
    };
    normalized: {
      data: Uint8Array;
      format: "pcm_s16le";
      sampleRate: 16_000;
      channels: 1;
      bitDepth: 16;
      durationMs: number;
    };
  };
  /** Server-side cancellation signal for an interrupted analysis request. */
  signal?: AbortSignal;
}

export interface SpeechFeedbackResult {
  rhythm: SupportedStarRating;
  fluency: SupportedStarRating;
  clarity: SupportedStarRating;
  praise: PraiseWord;
  comments: {
    rhythm: string;
    fluency: string;
    clarity: string;
  };
}

export const SAFE_CLASSROOM_FEEDBACK: SpeechFeedbackResult = {
  rhythm: 4.5,
  fluency: 4.5,
  clarity: 4.5,
  praise: "Wonderful!",
  comments: {
    rhythm: "Your rhythm is steady and expressive.",
    fluency: "Your reading flows with growing confidence.",
    clarity: "Your words are clear and well paced.",
  },
};

export interface SpeechAnalyzer {
  analyze(input: SpeechAnalysisInput): Promise<SpeechFeedbackResult>;
}

export interface AnalysisLogger {
  warn(message: string, details?: Record<string, unknown>): void;
}
