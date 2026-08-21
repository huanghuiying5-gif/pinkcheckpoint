import type { RecordingCharacteristicsInput, SpeechAnalysisApiClient } from "./SpeechAnalysisApiClient.js";

export interface CompletedBrowserRecording {
  audio: Blob;
  mimeType: string;
}

export interface PassageForAnalysis {
  referenceText: string;
  passageRevision?: number;
}

export interface BackgroundPreparationGateOptions {
  onEvent?: (event: string, sessionId?: string) => void;
}

/**
 * Joins independently-resolved browser recording inputs before starting one
 * reusable background request. This is deliberately UI-agnostic so timing and
 * StrictMode-style repeats can be verified without mounting React.
 */
export class BackgroundPreparationGate {
  private recording: CompletedBrowserRecording | null = null;
  private characteristics: {
    audio: Blob;
    value: RecordingCharacteristicsInput;
  } | null = null;
  private passage: PassageForAnalysis = { referenceText: "" };
  private preparedKey: string | null = null;
  private sessionId: string | null = null;

  constructor(
    private readonly speechAnalysis: SpeechAnalysisApiClient,
    private readonly options: BackgroundPreparationGateOptions = {},
  ) {}

  setPassage(passage: PassageForAnalysis): void {
    const changed =
      passage.referenceText !== this.passage.referenceText ||
      passage.passageRevision !== this.passage.passageRevision;
    this.passage = passage;
    if (changed && this.preparedKey) {
      this.speechAnalysis.cancelPreparedAnalysis(this.sessionId ?? undefined);
      this.preparedKey = null;
      this.sessionId = null;
      this.options.onEvent?.("prepared handle replaced");
    }
    this.tryPrepare();
  }

  setRecording(recording: CompletedBrowserRecording | null): void {
    if (
      !recording ||
      recording.audio.size === 0 ||
      recording.mimeType.trim().length === 0
    ) {
      this.reset();
      return;
    }
    if (this.recording?.audio === recording.audio) {
      return;
    }
    if (this.recording) {
      this.speechAnalysis.cancelPreparedAnalysis(this.sessionId ?? undefined);
      this.preparedKey = null;
      this.sessionId = null;
      this.options.onEvent?.("prepared handle replaced");
    }
    this.recording = recording;
    if (this.characteristics?.audio !== recording.audio) {
      this.characteristics = null;
    }
    this.tryPrepare();
  }

  setCharacteristics(audio: Blob, value: RecordingCharacteristicsInput): void {
    if (audio.size === 0) return;
    if (this.recording && this.recording.audio !== audio) return;
    this.characteristics = { audio, value };
    this.tryPrepare();
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  cancelPreparedAnalysis(): void {
    this.speechAnalysis.cancelPreparedAnalysis(this.sessionId ?? undefined);
    this.preparedKey = null;
    this.sessionId = null;
  }

  reset(): void {
    this.cancelPreparedAnalysis();
    this.recording = null;
    this.characteristics = null;
  }

  private tryPrepare(): void {
    const recording = this.recording;
    const characteristics = this.characteristics;
    if (
      !recording ||
      !characteristics ||
      characteristics.audio !== recording.audio ||
      this.passage.referenceText.trim().length === 0
    ) {
      return;
    }
    const key = [
      characteristics.value.attemptId,
      this.passage.passageRevision ?? "",
      this.passage.referenceText,
    ].join("|");
    if (key === this.preparedKey) return;

    const prepared = this.speechAnalysis.prepareAnalysis({
      audio: recording.audio,
      recording: characteristics.value,
      referenceText: this.passage.referenceText,
      passageRevision: this.passage.passageRevision,
    });
    this.preparedKey = key;
    this.sessionId = prepared.sessionId;
    this.options.onEvent?.("prepared analysis created", prepared.sessionId);
  }
}
