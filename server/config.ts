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
  xunfei: XunfeiServerConfig;
}

export interface XunfeiServerConfig {
  appId?: string;
  apiKey?: string;
  apiSecret?: string;
  iseUrl: string;
  requestTimeoutMs: number;
  frameBytes: number;
  frameIntervalMs: number;
}

function optional(environment: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = environment[key]?.trim();
  return value || undefined;
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
    xunfei: {
      appId: optional(environment, "XFYUN_APP_ID"),
      apiKey: optional(environment, "XFYUN_API_KEY"),
      apiSecret: optional(environment, "XFYUN_API_SECRET"),
      iseUrl:
        optional(environment, "XFYUN_ISE_URL") ??
        "wss://ise-api.xfyun.cn/v2/open-ise",
      requestTimeoutMs: positiveInteger(
        environment,
        "XFYUN_REQUEST_TIMEOUT_MS",
        15_000,
        1_000,
        60_000,
      ),
      frameBytes: positiveInteger(
        environment,
        "XFYUN_FRAME_BYTES",
        19_200,
        1,
        19_200,
      ),
      frameIntervalMs: positiveInteger(
        environment,
        "XFYUN_FRAME_INTERVAL_MS",
        40,
        1,
        5_000,
      ),
    },
  };
}
