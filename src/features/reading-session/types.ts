export type ReadingSessionPhase =
  | "idle"
  | "countdown"
  | "recording"
  | "review";

export interface ReadingSessionState {
  phase: ReadingSessionPhase;
  countdown: number;
  elapsedSeconds: number;
}
