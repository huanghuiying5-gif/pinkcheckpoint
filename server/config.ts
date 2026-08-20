import type { AnalysisMode } from "../src/services/analysis/types.js";

export interface ServerConfig {
  port: number;
  databasePath: string;
  teacherPassword: string;
  sessionSecret: string;
  sessionTtlMs: number;
  secureCookie: boolean;
  aiMode: AnalysisMode;
  ffmpegPath: string;
  audioUploadMaxBytes: number;
  audioNormalizationTimeoutMs: number;
}

function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function positiveInteger(
  environment: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = environment[key]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}.`);
  }

  return value;
}

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const sessionSecret = required(environment, "SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return {
    port: Number(environment.PORT ?? 3001),
    databasePath:
      environment.DATABASE_PATH?.trim() || "./data/speak-with-rhythm.sqlite",
    teacherPassword: required(environment, "TEACHER_SETUP_PASSWORD"),
    sessionSecret,
    sessionTtlMs: 8 * 60 * 60 * 1_000,
    secureCookie: environment.NODE_ENV === "production",
    aiMode:
      environment.AI_MODE?.trim().toLowerCase() === "xunfei"
        ? "xunfei"
        : "mock",
    ffmpegPath: environment.FFMPEG_PATH?.trim() || "ffmpeg",
    audioUploadMaxBytes: positiveInteger(
      environment,
      "AUDIO_UPLOAD_MAX_BYTES",
      15 * 1024 * 1024,
      1,
      50 * 1024 * 1024,
    ),
    audioNormalizationTimeoutMs: positiveInteger(
      environment,
      "AUDIO_NORMALIZATION_TIMEOUT_MS",
      15_000,
      1_000,
      60_000,
    ),
  };
}
