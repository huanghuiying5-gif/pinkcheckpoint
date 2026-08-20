import type { RecordingCharacteristics } from "../../features/recording";
import type { SpeechFeedbackResult } from "./types";
import { SAFE_CLASSROOM_FEEDBACK } from "./types";

export interface AnalyzeRecordingInput {
  recording: RecordingCharacteristics;
  /** Original browser recording; it remains in memory until this request completes. */
  audio?: Blob;
  referenceText: string;
  passageRevision?: number;
}

function fileNameForAudio(audio: Blob): string {
  const mimeType = audio.type.toLowerCase().split(";", 1)[0];
  if (mimeType === "audio/webm") {
    return "recording.webm";
  }
  if (mimeType === "audio/mp4") {
    return "recording.mp4";
  }
  if (mimeType === "audio/ogg") {
    return "recording.ogg";
  }
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
        },
        body: createAnalysisFormData(input),
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
