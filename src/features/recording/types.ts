export type MicrophoneStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "recording"
  | "error";

export interface RecordedAudio {
  blob: Blob;
  mimeType: string;
}
