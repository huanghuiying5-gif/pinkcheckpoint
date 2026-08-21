import { MockAnalyzer } from "./mockAnalyzer.js";
import type {
  SpeechAnalysisInput,
  SpeechFeedbackResult,
} from "./types.js";
import { SAFE_CLASSROOM_FEEDBACK } from "./types.js";

export interface AnalyzeRecordingInput {
  recording: RecordingCharacteristicsInput;
  /** Original browser recording; it remains in memory only for this request. */
  audio?: Blob;
  referenceText: string;
  passageRevision?: number;
}

export interface RecordingCharacteristicsInput {
  attemptId: string;
  volumeStability: number;
  volumeVariation: number;
  recordingQuality: number;
  voicePresence: number;
  durationSeconds: number;
  signature: number;
}

export interface PreparedSpeechAnalysis {
  readonly sessionId: string;
  readonly providerResultPromise: Promise<SpeechFeedbackResult>;
  readonly fallbackResult: SpeechFeedbackResult;
  resolveForClassroom(deadlineMs?: number): SpeechFeedbackResult;
  cancel(): void;
}

type FetchImplementation = typeof fetch;

interface SpeechAnalysisApiClientOptions {
  apiBaseUrl?: string;
  fetchImplementation?: FetchImplementation;
  mockAnalyzer?: MockAnalyzer;
}

function fileNameForAudio(audio: Blob): string {
  const mimeType = audio.type.toLowerCase().split(";", 1)[0];
  if (mimeType === "audio/webm") return "recording.webm";
  if (mimeType === "audio/mp4") return "recording.mp4";
  if (mimeType === "audio/ogg") return "recording.ogg";
  return "recording.audio";
}

function createAnalysisFormData(input: AnalyzeRecordingInput): FormData {
  const formData = new FormData();
  if (input.audio) {
    formData.append("audio", input.audio, fileNameForAudio(input.audio));
  }
  formData.append("recording", JSON.stringify(input.recording));
  formData.append("referenceText", input.referenceText);
  if (input.passageRevision !== undefined) {
    formData.append("passageRevision", String(input.passageRevision));
  }
  return formData;
}

function isFeedbackResult(value: unknown): value is SpeechFeedbackResult {
  if (value === null || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const comments = result.comments as Record<string, unknown> | undefined;
  const ratings = [result.rhythm, result.fluency, result.clarity];
  return (
    ratings.every((rating) => [3.5, 4, 4.5, 5].includes(rating as number)) &&
    typeof result.praise === "string" &&
    typeof comments?.rhythm === "string" &&
    typeof comments.fluency === "string" &&
    typeof comments.clarity === "string"
  );
}

function toMockInput(input: AnalyzeRecordingInput): SpeechAnalysisInput {
  return {
    ...input.recording,
    referenceText: input.referenceText,
    passageRevision: input.passageRevision,
  };
}

class PreparedSpeechAnalysisHandle implements PreparedSpeechAnalysis {
  private providerResult: SpeechFeedbackResult | null = null;
  private cancelled = false;

  readonly providerResultPromise: Promise<SpeechFeedbackResult>;

  constructor(
    readonly sessionId: string,
    readonly fallbackResult: SpeechFeedbackResult,
    private readonly controller: AbortController,
    request: Promise<SpeechFeedbackResult>,
  ) {
    this.providerResultPromise = request.then((result) => {
      if (!this.cancelled && isFeedbackResult(result)) {
        this.providerResult = result;
        return result;
      }
      throw new Error("Prepared speech analysis did not return valid feedback.");
    });
    // Provider failures are intentionally absorbed by the prepared fallback.
    void this.providerResultPromise.catch(() => undefined);
  }

  resolveForClassroom(_deadlineMs = 0): SpeechFeedbackResult {
    if (this.providerResult) return this.providerResult;
    this.cancel();
    return this.fallbackResult;
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.controller.abort();
  }
}

/**
 * Browser-only analysis boundary. It owns one cancellable preparation per
 * completed recording; route components never know which provider answered.
 */
export class SpeechAnalysisApiClient {
  private latestResult: SpeechFeedbackResult | null = null;
  private prepared: PreparedSpeechAnalysisHandle | null = null;
  private preparedInputKey: string | null = null;
  private readonly apiBaseUrl: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly mockAnalyzer: MockAnalyzer;

  constructor(options: SpeechAnalysisApiClientOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl ?? "";
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.mockAnalyzer = options.mockAnalyzer ?? new MockAnalyzer();
  }

  private async requestAnalysis(
    input: AnalyzeRecordingInput,
    signal: AbortSignal,
  ): Promise<SpeechFeedbackResult> {
    const response = await this.fetchImplementation(
      `${this.apiBaseUrl}/api/speech-analysis`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        body: createAnalysisFormData(input),
        signal,
      },
    );
    if (!response.ok) {
      throw new Error("Speech analysis request failed.");
    }
    const result: unknown = await response.json();
    if (!isFeedbackResult(result)) {
      throw new Error("Speech analysis response was invalid.");
    }
    return result;
  }

  prepareAnalysis(input: AnalyzeRecordingInput): PreparedSpeechAnalysis {
    const inputKey = [
      input.recording.attemptId,
      input.passageRevision ?? "",
      input.referenceText,
    ].join("|");
    if (this.prepared && this.preparedInputKey === inputKey) {
      return this.prepared;
    }
    this.cancelPreparedAnalysis();
    const controller = new AbortController();
    const prepared = new PreparedSpeechAnalysisHandle(
      input.recording.attemptId,
      this.mockAnalyzer.generate(toMockInput(input)),
      controller,
      this.requestAnalysis(input, controller.signal),
    );
    this.prepared = prepared;
    this.preparedInputKey = inputKey;
    this.latestResult = null;
    return prepared;
  }

  getPreparedSessionId(): string | null {
    return this.prepared?.sessionId ?? null;
  }

  resolvePreparedAnalysis(sessionId?: string | null): SpeechFeedbackResult {
    const prepared = this.prepared;
    if (!prepared || (sessionId && prepared.sessionId !== sessionId)) {
      this.latestResult = SAFE_CLASSROOM_FEEDBACK;
      return this.latestResult;
    }
    this.latestResult = prepared.resolveForClassroom();
    prepared.cancel();
    this.prepared = null;
    this.preparedInputKey = null;
    return this.latestResult;
  }

  cancelPreparedAnalysis(sessionId?: string): void {
    if (sessionId && this.prepared?.sessionId !== sessionId) return;
    this.prepared?.cancel();
    this.prepared = null;
    this.preparedInputKey = null;
  }

  getLatestResult(): SpeechFeedbackResult {
    return this.latestResult ?? SAFE_CLASSROOM_FEEDBACK;
  }
}
