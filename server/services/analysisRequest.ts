import type { SpeechAnalysisInput } from "../../src/services/analysis/types.js";

function finiteNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function parseSpeechAnalysisInput(body: unknown): SpeechAnalysisInput {
  const request = body as { recording?: Record<string, unknown> } | null;
  const recording = request?.recording ?? {};
  const signature = Math.trunc(
    finiteNumber(recording.signature, Date.now() >>> 0, 0, 0xffff_ffff),
  );

  return {
    attemptId:
      typeof recording.attemptId === "string" && recording.attemptId.trim()
        ? recording.attemptId.slice(0, 160)
        : `server-attempt-${signature}`,
    volumeStability: finiteNumber(recording.volumeStability, 0.65, 0, 1),
    volumeVariation: finiteNumber(recording.volumeVariation, 0.5, 0, 1),
    recordingQuality: finiteNumber(recording.recordingQuality, 0.72, 0, 1),
    voicePresence: finiteNumber(recording.voicePresence, 0.75, 0, 1),
    durationSeconds: finiteNumber(recording.durationSeconds, 0, 0, 3_600),
    signature,
  };
}
