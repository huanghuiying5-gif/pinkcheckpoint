import type { SpeechAnalysisInput } from "../../src/services/analysis/types.js";

export const MAX_REFERENCE_TEXT_LENGTH = 5_000;

export class SpeechAnalysisRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeechAnalysisRequestValidationError";
  }
}

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

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function parseRecordingValue(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") {
    return objectValue(value);
  }

  try {
    return objectValue(JSON.parse(value));
  } catch {
    return {};
  }
}

function toSpeechAnalysisInput(
  recording: Record<string, unknown>,
): SpeechAnalysisInput {
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

/** Tolerant parser used only to preserve a classroom-safe mock fallback. */
export function parseSpeechAnalysisInput(body: unknown): SpeechAnalysisInput {
  const request = objectValue(body);
  return toSpeechAnalysisInput(parseRecordingValue(request.recording));
}

function requiredString(
  request: Record<string, unknown>,
  key: string,
): string {
  const value = request[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new SpeechAnalysisRequestValidationError(`${key} is required.`);
  }
  return value;
}

function parseOptionalRevision(value: unknown): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new SpeechAnalysisRequestValidationError(
      "passageRevision must be a positive integer.",
    );
  }

  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new SpeechAnalysisRequestValidationError(
      "passageRevision must be a positive integer.",
    );
  }

  return revision;
}

/** Strict parser for the multipart audio upload contract. */
export function parseMultipartSpeechAnalysisInput(
  body: unknown,
): SpeechAnalysisInput {
  const request = objectValue(body);
  const serializedRecording = requiredString(request, "recording");
  let recording: Record<string, unknown>;

  try {
    recording = objectValue(JSON.parse(serializedRecording));
  } catch {
    throw new SpeechAnalysisRequestValidationError("recording must be valid JSON.");
  }

  if (Object.keys(recording).length === 0) {
    throw new SpeechAnalysisRequestValidationError(
      "recording must contain characteristics.",
    );
  }

  const referenceText = requiredString(request, "referenceText");
  if (referenceText.length > MAX_REFERENCE_TEXT_LENGTH) {
    throw new SpeechAnalysisRequestValidationError(
      `referenceText cannot exceed ${MAX_REFERENCE_TEXT_LENGTH} characters.`,
    );
  }

  return {
    ...toSpeechAnalysisInput(recording),
    referenceText,
    passageRevision: parseOptionalRevision(request.passageRevision),
  };
}
