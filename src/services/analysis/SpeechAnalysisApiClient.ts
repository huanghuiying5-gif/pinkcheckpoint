import type { RecordingCharacteristics } from "../../features/recording";
import type { SpeechFeedbackResult } from "./types";
import { SAFE_CLASSROOM_FEEDBACK } from "./types";

export interface AnalyzeRecordingInput {
  recording: RecordingCharacteristics;
  /** Reserved for the Phase 2 provider upload without changing UI callers. */
  audio?: Blob;
}

export class SpeechAnalysisApiClient {
  private latestResult: SpeechFeedbackResult | null = null;
  private analysisSequence = 0;

  constructor(private readonly apiBaseUrl = "") {}

  private async requestAnalysis(
    input: AnalyzeRecordingInput,
    signal?: AbortSignal,
  ): Promise<SpeechFeedbackResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/speech-analysis`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recording: input.recording }),
        signal,
      });

      if (!response.ok) {
        throw new Error("Speech analysis request failed.");
      }

      return (await response.json()) as SpeechFeedbackResult;
    } catch {
      // Keep the classroom flow moving even if the local server request drops.
      return SAFE_CLASSROOM_FEEDBACK;
    }
  }

  async analyze(
    input: AnalyzeRecordingInput,
    signal?: AbortSignal,
  ): Promise<SpeechFeedbackResult> {
    const sequence = ++this.analysisSequence;
    this.latestResult = null;
    const result = await this.requestAnalysis(input, signal);

    if (sequence === this.analysisSequence) {
      this.latestResult = result;
    }

    return result;
  }

  startAnalysis(
    input: AnalyzeRecordingInput | Promise<AnalyzeRecordingInput>,
  ): void {
    const sequence = ++this.analysisSequence;
    this.latestResult = null;

    void Promise.resolve(input)
      .then((resolvedInput) => this.requestAnalysis(resolvedInput))
      .then((result) => {
        if (sequence === this.analysisSequence) {
          this.latestResult = result;
        }
      })
      .catch(() => {
        if (sequence === this.analysisSequence) {
          this.latestResult = SAFE_CLASSROOM_FEEDBACK;
        }
      });
  }

  getLatestResult(): SpeechFeedbackResult {
    return this.latestResult ?? SAFE_CLASSROOM_FEEDBACK;
  }
}
